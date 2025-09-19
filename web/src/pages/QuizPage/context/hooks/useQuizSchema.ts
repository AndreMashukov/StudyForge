import { z } from 'zod';

// Quiz answer validation schema
export const quizAnswerSchema = z.object({
  selectedAnswer: z
    .number()
    .min(0, 'Please select an answer')
    .int('Answer must be a valid option'),
  questionId: z
    .number()
    .positive('Question ID must be positive'),
});

export type QuizAnswerFormData = z.infer<typeof quizAnswerSchema>;

// Quiz question validation schema (for external quiz data)
export const quizQuestionSchema = z.object({
  id: z.number().positive('Question ID must be positive'),
  question: z.string().min(1, 'Question text is required'),
  options: z
    .array(z.string().min(1, 'Option text cannot be empty'))
    .min(2, 'At least 2 options are required')
    .max(6, 'Maximum 6 options allowed'),
  correct: z
    .number()
    .min(0, 'Correct answer index must be non-negative')
    .int('Correct answer must be a valid option index'),
  explanation: z.string().min(1, 'Explanation is required'),
}).refine((data) => {
  return data.correct < data.options.length;
}, {
  message: 'Correct answer index must be within options range',
  path: ['correct'],
});

// Quiz data validation schema
export const quizDataSchema = z.object({
  questions: z
    .array(quizQuestionSchema)
    .min(1, 'At least one question is required')
    .max(50, 'Maximum 50 questions allowed'),
  title: z.string().min(1, 'Quiz title is required').optional(),
  description: z.string().optional(),
  timeLimit: z.number().positive('Time limit must be positive').optional(),
});

export type QuizDataFormData = z.infer<typeof quizDataSchema>;

// Quiz submission validation
export const quizSubmissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.number().positive(),
    selectedAnswer: z.number().min(-1), // -1 for skipped questions
    timeSpent: z.number().min(0),
  })),
  totalTime: z.number().min(0),
  score: z.number().min(0),
});

export type QuizSubmissionData = z.infer<typeof quizSubmissionSchema>;

// Common validation helpers
export const createRequiredAnswerField = () =>
  z.number().min(0, 'Please select an answer');

export const createOptionalTimeField = () =>
  z.number().min(0).optional();

// Validation error handling helper
export const handleQuizValidationError = (error: z.ZodError): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};
  
  error.issues.forEach((issue) => {
    const fieldPath = issue.path.join('.');
    fieldErrors[fieldPath] = issue.message;
  });
  
  return fieldErrors;
};