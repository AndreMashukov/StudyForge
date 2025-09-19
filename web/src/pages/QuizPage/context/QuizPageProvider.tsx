import React, { ReactNode, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { QuizPageContext } from './QuizPageContext';
import { useQuizHandlers } from './hooks/useQuizHandlers';
import { useQuizForm } from './hooks/useQuizForm';
import { useQuizEffects } from './hooks/useQuizEffects';
import { useFetchQuizData } from './hooks/api/useFetchQuizData';
import {
  selectCurrentQuestion,
  selectProgress,
  selectQuizStats,
  selectIsLoading,
  selectError,
  loadQuiz,
} from '../../../store/slices/quizPageSlice';
import { IQuizPageContext } from '../types/IQuizPageContext';

interface IQuizPageProvider {
  children: ReactNode;
}

export const QuizPageProvider = ({ children }: IQuizPageProvider) => {
  const dispatch = useDispatch();
  const loadedQuizIdRef = useRef<string | null>(null);
  
  // API data fetching
  const quizData = useFetchQuizData();
  
  // Redux state selectors
  const currentQuestion = useSelector(selectCurrentQuestion);
  const progress = useSelector(selectProgress);
  const stats = useSelector(selectQuizStats);
  const isLoading = useSelector(selectIsLoading) || quizData.isLoading;
  const error = useSelector(selectError) || quizData.error;

  // Hooks
  const handlers = useQuizHandlers();
  const formHandlers = useQuizForm();

  // Load quiz data when it becomes available (fixed to avoid infinite loop)
  useEffect(() => {
    if (quizData.firestoreQuiz && 
        quizData.questions.length > 0 && 
        loadedQuizIdRef.current !== quizData.firestoreQuiz.id) {
      
      loadedQuizIdRef.current = quizData.firestoreQuiz.id;
      dispatch(loadQuiz({ 
        quiz: quizData.firestoreQuiz, 
        questions: quizData.questions 
      }));
    }
  }, [quizData.firestoreQuiz, quizData.questions, dispatch]);

  // Effects
  useQuizEffects({
    onQuizStart: () => {
      console.log('Quiz started');
    },
    onQuestionChange: (questionIndex: number) => {
      console.log(`Question changed to index: ${questionIndex}`);
    },
    onAnswerSubmit: (answer) => {
      console.log('Answer submitted:', answer);
    },
    onQuizComplete: (quizStats) => {
      console.log('Quiz completed with stats:', quizStats);
    },
    onTimeUpdate: (currentTime) => {
      // Could dispatch time updates to Redux if needed
      // console.log('Time update:', currentTime);
    },
  });

  const contextValue: IQuizPageContext = {
    // Computed data from Redux state
    currentQuestion,
    progress,
    stats,
    
    // Handlers
    handlers: {
      handleLoadQuiz: handlers.handleLoadQuiz,
      handleAnswerSelect: handlers.handleAnswerSelect,
      handleNextQuestion: handlers.handleNextQuestion,
      handleResetQuiz: handlers.handleResetQuiz,
      handleStartQuiz: handlers.handleStartQuiz,
      handleCompleteQuiz: handlers.handleCompleteQuiz,
      handleSkipQuestion: handlers.handleSkipQuestion,
    },
    formHandlers: {
      handleSubmitAnswer: formHandlers.handleSubmitAnswer,
      handleValidateAnswer: formHandlers.handleValidateAnswer,
      clearFormErrors: formHandlers.clearFormErrors,
    },
    
    // Loading states
    isLoading,
    error,
  };

  return (
    <QuizPageContext.Provider value={contextValue}>
      {children}
    </QuizPageContext.Provider>
  );
};