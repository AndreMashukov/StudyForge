# Quiz Followup Feature Implementation Roadmap

## Overview

This roadmap outlines the implementation of a Quiz Followup Feature that generates comprehensive explanations with ASCII diagrams for quiz questions using the Gemini AI service. The feature will create markdown documents with deep explanations following established architectural patterns.

## Feature Requirements Summary

- **Trigger**: Followup button appears after answering any question (correct or incorrect)
- **Content**: Comprehensive explanation covering the topic with ASCII diagrams
- **Integration**: New Gemini endpoint for explanation generation
- **Storage**: Follow existing document generation logic with naming pattern `[documentname]-quiz-followup-[timestamp].md`
- **UI**: Button changes to "Followup Generated" and becomes disabled after use
- **Context**: Include original markdown file content in Gemini prompt if possible

---

## Phase 1: Backend Infrastructure (Functions)

### 1.1 Create Shared Types for Followup Feature

**File**: `libs/shared-types/src/index.ts`

```typescript
// Quiz Followup API Types
export interface GenerateFollowupRequest {
  documentId: string;
  questionText: string;
  userSelectedAnswer: string;
  correctAnswer?: string;
  questionOptions?: string[];
  quizTitle?: string;
}

export interface GenerateFollowupResponse {
  documentId: string;
  title: string;
  content: string;
}

export interface QuizFollowupContext {
  originalDocument: {
    title: string;
    content: string;
  };
  question: {
    text: string;
    options: string[];
    userAnswer: string;
    correctAnswer?: string;
  };
  quiz: {
    title: string;
  };
}
```

### 1.2 Extend Gemini Service for Followup Generation

**File**: `functions/src/services/gemini/gemini.ts`

Add new method:

```typescript
/**
 * Generate comprehensive followup explanation for quiz question
 * @param context - Complete context including original document and question details
 * @returns Generated markdown content with ASCII diagrams
 */
public static async generateQuizFollowup(context: QuizFollowupContext): Promise<string> {
  try {
    functions.logger.info('Generating quiz followup explanation with Gemini AI');

    const genAI = this.getClient();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });

    const prompt = PromptBuilder.buildFollowupPrompt(context);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Empty response from Gemini API for followup generation');
    }

    functions.logger.info('Quiz followup generated successfully', { length: text.length });
    return text;

  } catch (error) {
    functions.logger.error('Error generating quiz followup with Gemini AI:', error);
    throw new Error(`Failed to generate followup: ${error}`);
  }
}
```

### 1.3 Create Followup Prompt Builder

**File**: `functions/src/services/gemini/prompt-builder.ts`

Add new method:

```typescript
/**
 * Build comprehensive followup explanation prompt
 */
static buildFollowupPrompt(context: QuizFollowupContext): string {
  return `
You are an expert educator creating comprehensive followup explanations for quiz questions. 

ORIGINAL DOCUMENT CONTEXT:
Title: "${context.originalDocument.title}"
Content: 
${context.originalDocument.content}

QUIZ CONTEXT:
Quiz Title: "${context.quiz.title}"
Question: "${context.question.text}"
Available Options: ${context.question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}
User's Answer: "${context.question.userAnswer}"
${context.question.correctAnswer ? `Correct Answer: "${context.question.correctAnswer}"` : ''}

TASK:
Generate a comprehensive educational explanation in markdown format that:

1. **Explains the core concept** being tested in the question
2. **Provides detailed analysis** of why each answer option is correct/incorrect
3. **Includes exactly 2 ASCII diagrams**:
   - Diagram 1: Conceptual overview showing the main concept visually
   - Diagram 2: Detailed process/implementation showing step-by-step breakdown
4. **Connects to the original document** by referencing specific sections
5. **Offers practical insights** and memory aids for understanding

FORMATTING REQUIREMENTS:
- Use proper markdown structure with clear headings
- Include exactly 2 ASCII diagrams with explanatory text
- Use code blocks (\`\`\`) for ASCII diagrams
- Follow the ascii-diagram-rule patterns for visual clarity
- Create educational content suitable for deep learning

DIAGRAM REQUIREMENTS:
- Use boxes, arrows, and symbols: → ↑ ↓ ← ✅ ❌ ⚠️ 🔄 ⭐
- Make diagrams informative and easy to understand  
- Explain each diagram after showing it
- Ensure diagrams complement the textual explanation

Generate comprehensive, educational markdown content that helps the learner deeply understand the topic.
`;
}
```

### 1.4 Create New Endpoint for Followup Generation

**File**: `functions/src/endpoints/quiz-followup.ts`

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { DocumentCrudService } from '../services/document-crud.js';
import { GeminiService } from '../services/gemini/gemini.js';
import { 
  GenerateFollowupRequest, 
  GenerateFollowupResponse,
  QuizFollowupContext,
  CreateDocumentRequest,
  DocumentSourceType,
  DocumentStatus,
} from "../../libs/shared-types/src/index";

/**
 * Authentication middleware for callable functions
 */
async function validateAuth(context: { auth?: { uid?: string } }): Promise<string> {
  if (!context.auth?.uid) {
    throw new Error('Authentication required');
  }
  return context.auth.uid;
}

/**
 * Generate comprehensive followup explanation for quiz question
 */
export const generateQuizFollowup = onCall(
  { 
    region: 'asia-east1',
    cors: true,
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GenerateFollowupRequest;

      logger.info('Generating quiz followup explanation', { 
        userId,
        documentId: data.documentId,
        questionLength: data.questionText?.length,
      });

      // Validate request
      if (!data.documentId || !data.questionText || !data.userSelectedAnswer) {
        throw new Error('Missing required fields: documentId, questionText, userSelectedAnswer');
      }

      // Get original document with content
      const originalDocument = await DocumentCrudService.getDocumentWithContent(userId, data.documentId);

      // Prepare context for Gemini
      const followupContext: QuizFollowupContext = {
        originalDocument: {
          title: originalDocument.title,
          content: originalDocument.content || '',
        },
        question: {
          text: data.questionText,
          options: data.questionOptions || [],
          userAnswer: data.userSelectedAnswer,
          correctAnswer: data.correctAnswer,
        },
        quiz: {
          title: data.quizTitle || `Quiz from ${originalDocument.title}`,
        },
      };

      // Generate followup content with Gemini
      const followupContent = await GeminiService.generateQuizFollowup(followupContext);

      // Create followup document
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const followupTitle = `${originalDocument.title}-quiz-followup-${timestamp}`;

      const createRequest: CreateDocumentRequest = {
        title: followupTitle,
        description: `Comprehensive followup explanation for quiz question from "${originalDocument.title}"`,
        content: followupContent,
        sourceType: DocumentSourceType.GENERATED,
        status: DocumentStatus.ACTIVE,
        tags: ['quiz-followup', 'explanation', 'generated'],
      };

      const followupDocument = await DocumentCrudService.createDocument(userId, createRequest);

      logger.info('Quiz followup document created successfully', { 
        followupDocId: followupDocument.id,
        originalDocId: data.documentId,
      });

      return { 
        success: true, 
        data: {
          documentId: followupDocument.id,
          title: followupDocument.title,
          content: followupContent,
        },
      };

    } catch (error) {
      logger.error('Failed to generate quiz followup', { 
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to generate followup explanation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
```

### 1.5 Export New Endpoint

**File**: `functions/src/index.ts`

Add export:

```typescript
// Export quiz followup functions
export {
  generateQuizFollowup,
} from "./endpoints/quiz-followup.js";
```

---

## Phase 2: Frontend API Integration

### 2.1 Create RTK Query API Endpoint

**File**: `web/src/store/api/QuizFollowup/QuizFollowupApi.ts`

```typescript
import { baseApi } from "../baseApi";
import { IGenerateFollowupRequest, IGenerateFollowupResponse } from "./IQuizFollowupApi";

export const quizFollowupApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateQuizFollowup: builder.mutation<IGenerateFollowupResponse, IGenerateFollowupRequest>({
      query: (data) => ({
        url: "/generateQuizFollowup",
        method: "POST",
        data,
      }),
      invalidatesTags: [{ type: "Document", id: "LIST" }],
    }),
  }),
});

export const {
  useGenerateQuizFollowupMutation,
} = quizFollowupApi;
```

### 2.2 Create API Types

**File**: `web/src/store/api/QuizFollowup/IQuizFollowupApi.ts`

```typescript
export interface IGenerateFollowupRequest {
  documentId: string;
  questionText: string;
  userSelectedAnswer: string;
  correctAnswer?: string;
  questionOptions?: string[];
  quizTitle?: string;
}

export interface IGenerateFollowupResponse {
  documentId: string;
  title: string;
  content: string;
}
```

---

## Phase 3: Frontend UI Implementation

### 3.1 Add Followup Button State to Redux

**File**: `web/src/store/slices/quizPageSlice.ts`

Add to quiz state:

```typescript
interface IQuizState {
  // ... existing properties
  followupGenerated: Record<number, boolean>; // Track which questions have followup generated
  isGeneratingFollowup: boolean;
  followupError: string | null;
}

// Add actions
const quizPageSlice = createSlice({
  // ... existing code
  reducers: {
    // ... existing reducers
    setFollowupGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingFollowup = action.payload;
      state.followupError = null;
    },
    setFollowupGenerated: (state, action: PayloadAction<{ questionIndex: number }>) => {
      state.followupGenerated[action.payload.questionIndex] = true;
      state.isGeneratingFollowup = false;
    },
    setFollowupError: (state, action: PayloadAction<string>) => {
      state.followupError = action.payload;
      state.isGeneratingFollowup = false;
    },
  },
});

export const {
  // ... existing exports
  setFollowupGenerating,
  setFollowupGenerated,
  setFollowupError,
} = quizPageSlice.actions;

// Add selectors
export const selectIsGeneratingFollowup = (state: RootState) => state.quizPage.isGeneratingFollowup;
export const selectFollowupGenerated = (state: RootState) => state.quizPage.followupGenerated;
export const selectFollowupError = (state: RootState) => state.followupError;
```

### 3.2 Add Followup Handler

**File**: `web/src/pages/QuizPage/context/hooks/useQuizPageHandlers.ts`

Add followup handler:

```typescript
import { useGenerateQuizFollowupMutation } from '../../../../store/api/QuizFollowup/QuizFollowupApi';
import { 
  setFollowupGenerating, 
  setFollowupGenerated, 
  setFollowupError 
} from '../../../../store/slices/quizPageSlice';

export const useQuizPageHandlers = () => {
  // ... existing code
  
  const [generateFollowup] = useGenerateQuizFollowupMutation();

  const handleGenerateFollowup = useCallback(async () => {
    try {
      const currentQuestion = useSelector(selectCurrentQuestion);
      const quizState = useSelector(selectQuizState);
      const formState = useSelector(selectFormState);
      
      if (!currentQuestion || formState.selectedAnswer === null) {
        return;
      }

      dispatch(setFollowupGenerating(true));

      const requestData: IGenerateFollowupRequest = {
        documentId: quizState.firestoreQuiz?.documentId || '',
        questionText: currentQuestion.question,
        userSelectedAnswer: currentQuestion.options[formState.selectedAnswer],
        correctAnswer: currentQuestion.options[currentQuestion.correct],
        questionOptions: currentQuestion.options,
        quizTitle: quizState.firestoreQuiz?.title,
      };

      await generateFollowup(requestData).unwrap();
      
      dispatch(setFollowupGenerated({ 
        questionIndex: quizState.currentQuestionIndex 
      }));

      enqueueSnackbar("Followup explanation generated successfully!", { 
        variant: "success" 
      });

    } catch (error) {
      const errorMessage = (error as any)?.data?.message || "Failed to generate followup explanation";
      dispatch(setFollowupError(errorMessage));
      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  }, [dispatch, generateFollowup, enqueueSnackbar]);

  return {
    // ... existing handlers
    handleGenerateFollowup,
  };
};
```

### 3.3 Update QuestionCard Component

**File**: `web/src/pages/QuizPage/QuizPageContainer/QuestionCard/IQuestionCard.ts`

Add followup props:

```typescript
export interface IQuestionCard {
  // ... existing props
  onGenerateFollowup?: () => void;
  isGeneratingFollowup?: boolean;
  isFollowupGenerated?: boolean;
}
```

**File**: `web/src/pages/QuizPage/QuizPageContainer/QuestionCard/QuestionCard.tsx`

Add followup button:

```typescript
export const QuestionCard: React.FC<IQuestionCard> = ({
  // ... existing props
  onGenerateFollowup,
  isGeneratingFollowup = false,
  isFollowupGenerated = false,
}) => {
  // ... existing code

  return (
    <Card className={cn('w-full', className)}>
      {/* ... existing content */}
      
      <CardContent className="space-y-3">
        {/* ... existing answer options and explanation */}

        {/* Action Buttons */}
        {showExplanation && (
          <div className="space-y-3 mt-6">
            {/* Next Question Button */}
            <Button
              onClick={onNextQuestion}
              className="w-full"
              size="lg"
            >
              {isLastQuestion ? 'View Results' : 'Next Question'}
            </Button>

            {/* Followup Button */}
            {onGenerateFollowup && (
              <Button
                onClick={onGenerateFollowup}
                variant="outline"
                className="w-full"
                size="lg"
                disabled={isFollowupGenerated || isGeneratingFollowup}
              >
                {isGeneratingFollowup ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                    Generating Followup...
                  </>
                ) : isFollowupGenerated ? (
                  'Followup Generated'
                ) : (
                  'Generate Detailed Explanation'
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### 3.4 Update QuizPageContainer

**File**: `web/src/pages/QuizPage/QuizPageContainer/QuizPageContainer.tsx`

Add followup integration:

```typescript
export const QuizPageContainer: React.FC = () => {
  // ... existing selectors
  const isGeneratingFollowup = useSelector(selectIsGeneratingFollowup);
  const followupGenerated = useSelector(selectFollowupGenerated);
  const followupError = useSelector(selectFollowupError);
  
  const { handlers, quizApi } = useQuizPageContext();

  // ... existing handlers

  const handleGenerateFollowup = () => {
    handlers.handleGenerateFollowup();
  };

  // ... existing code

  // Check if current question has followup generated
  const isCurrentFollowupGenerated = followupGenerated[quizState.currentQuestionIndex] || false;

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
      {/* ... existing progress bar */}

      {/* Question Card */}
      <QuestionCard
        question={currentQuestion}
        selectedAnswer={formState.selectedAnswer}
        showExplanation={quizState.showExplanation}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={handleNextQuestion}
        onGenerateFollowup={handleGenerateFollowup}
        isGeneratingFollowup={isGeneratingFollowup}
        isFollowupGenerated={isCurrentFollowupGenerated}
        isLastQuestion={isLastQuestion}
      />

      {/* Error Display for Followup */}
      {followupError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-destructive text-sm">{followupError}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

---

## Phase 4: Testing & Quality Assurance

### 4.1 Backend Testing

**Test File**: `functions/src/test/quiz-followup.test.ts`

```typescript
import { generateQuizFollowup } from '../endpoints/quiz-followup';
// Add comprehensive tests for followup generation
```

### 4.2 Frontend Testing

**Test File**: `web/src/pages/QuizPage/QuizPageContainer/QuestionCard/QuestionCard.test.tsx`

Add tests for:
- Followup button rendering
- Button state changes
- Loading states
- Error handling

### 4.3 Integration Testing

- Test complete flow: Question answer → Followup generation → Document creation
- Test with different question types and answer combinations
- Test error scenarios (network failures, API errors)

---

## Phase 5: Documentation & Deployment

### 5.1 Update API Documentation

Document the new `generateQuizFollowup` endpoint with:
- Request/response schemas
- Usage examples
- Error codes

### 5.2 Update User Guide

Add documentation for the followup feature:
- How to use the followup button
- What type of content is generated
- Where followup documents are stored

### 5.3 Deployment Checklist

- [ ] Deploy function with new endpoint
- [ ] Verify Gemini API integration
- [ ] Test document generation flow
- [ ] Monitor performance and error rates
- [ ] Update frontend with new UI

---

## Implementation Priority

1. **High Priority**: Backend infrastructure (Phase 1)
2. **High Priority**: Frontend API integration (Phase 2)
3. **Medium Priority**: UI implementation (Phase 3)
4. **Medium Priority**: Testing (Phase 4)
5. **Low Priority**: Documentation (Phase 5)

## Estimated Timeline

- **Phase 1**: 2-3 days
- **Phase 2**: 1 day
- **Phase 3**: 1-2 days
- **Phase 4**: 1 day
- **Phase 5**: 0.5 day

**Total**: 5.5-7.5 days

---

## Technical Considerations

### Performance
- Followup generation may take 10-30 seconds
- Implement proper loading states and timeouts
- Consider caching for identical questions (future enhancement)

### Security
- Validate user authentication for all endpoints
- Ensure users can only generate followups for their own quizzes
- Rate limiting for Gemini API calls

### Error Handling
- Handle Gemini API failures gracefully
- Provide meaningful error messages to users
- Log errors for monitoring and debugging

### Scalability
- Monitor Gemini API usage and costs
- Consider implementing retry logic for failed generations
- Plan for concurrent followup generation requests

---

This roadmap provides a comprehensive plan for implementing the Quiz Followup Feature while maintaining consistency with the existing codebase architecture and patterns.