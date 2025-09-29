import React from 'react';
import { useSelector } from 'react-redux';
import { useQuizPageContext } from '../../context';
import {
  selectQuizState,
  selectCurrentQuestion,
  selectProgress,
  selectQuizStats,
} from '../../../../store/slices/quizPageSlice';

/**
 * Example component demonstrating proper architecture:
 * - Components access Redux state directly with useSelector
 * - Context is used only for handlers and API objects
 * - No state is passed through context
 */
export const QuizDebugInfo: React.FC = () => {
  // ✅ CORRECT: Access Redux state directly
  const quizState = useSelector(selectQuizState);
  const currentQuestion = useSelector(selectCurrentQuestion);
  const progress = useSelector(selectProgress);
  const stats = useSelector(selectQuizStats);

  // ✅ CORRECT: Only get API from context (handlers not needed in this component)
  const { quizApi } = useQuizPageContext();

  // Calculate correct/incorrect from answers breakdown
  const correctAnswers = stats.answersBreakdown.filter(answer => answer.isCorrect).length;
  const incorrectAnswers = stats.answersBreakdown.filter(answer => !answer.isCorrect).length;

  const debugInfo = {
    // Redux State
    reduxState: {
      currentQuestionIndex: quizState.currentQuestionIndex,
      isCompleted: quizState.isCompleted,
      score: quizState.score,
      totalQuestions: quizState.questions.length,
      progress: progress,
      statsCorrect: correctAnswers,
      statsIncorrect: incorrectAnswers,
      currentQuestionId: currentQuestion?.id || 'none',
    },
    
    // API State
    apiState: {
      isLoading: quizApi.isLoading,
      isFetching: quizApi.isFetching,
      isError: quizApi.isError,
      isSuccess: quizApi.isSuccess,
      hasValidQuizId: quizApi.hasValidQuizId,
      quizId: quizApi.quizId,
      questionsCount: quizApi.questions.length,
      firestoreQuizTitle: quizApi.firestoreQuiz?.title || 'No title',
    },

    // Available Handlers
    availableHandlers: [
      'handleLoadQuiz',
      'handleAnswerSelect', 
      'handleNextQuestion',
      'handleResetQuiz',
      'handleStartQuiz',
      'handleCompleteQuiz',
      'handleSkipQuestion',
      'handleSubmitAnswer',
      'handleValidateAnswer',
      'clearFormErrors',
    ],
  };

  return (
    <div className="bg-muted/50 p-4 rounded-lg text-xs font-mono">
      <h3 className="font-semibold mb-2">Quiz Debug Info (Architecture Example)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h4 className="font-medium mb-1">Redux State:</h4>
          <pre className="bg-background p-2 rounded text-xs overflow-auto">
            {JSON.stringify(debugInfo.reduxState, null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="font-medium mb-1">API State:</h4>
          <pre className="bg-background p-2 rounded text-xs overflow-auto">
            {JSON.stringify(debugInfo.apiState, null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="font-medium mb-1">Available Handlers:</h4>
          <ul className="bg-background p-2 rounded text-xs space-y-1">
            {debugInfo.availableHandlers.map((handler) => (
              <li key={handler} className="text-primary">
                {handler}()
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="mt-4 p-2 bg-primary/10 rounded text-xs">
        <h4 className="font-medium mb-1">✅ Architecture Rules Followed:</h4>
        <ul className="space-y-1 text-primary">
          <li>• Components access Redux state directly with useSelector</li>
          <li>• Context provides only handlers and API objects</li>
          <li>• No Redux state passed through context</li>
          <li>• API hooks manage their own effects</li>
          <li>• Handler hooks contain no useEffect</li>
        </ul>
      </div>
    </div>
  );
};