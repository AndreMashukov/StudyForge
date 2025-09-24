import React, { ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MyQuizzesPageContext } from './MyQuizzesPageContext';
import { useGetUserQuizzesQuery, useDeleteQuizMutation } from '../../../store/api/Quiz/QuizApi';
import { GroupedQuizzes } from '../types/IMyQuizzesPageTypes';
import { Quiz } from '@shared-types';

interface IMyQuizzesPageProvider {
  children: ReactNode;
}

export const MyQuizzesPageProvider: React.FC<IMyQuizzesPageProvider> = ({ children }) => {
  const navigate = useNavigate();
  
  // Fetch user quizzes
  const {
    data: userQuizzesData,
    isLoading: isLoadingQuizzes,
    error: quizzesError,
    refetch: refetchQuizzes,
  } = useGetUserQuizzesQuery();

  // Delete quiz mutation
  const [deleteQuizMutation, { isLoading: isDeletingQuiz }] = useDeleteQuizMutation();

  const quizzes: Quiz[] = userQuizzesData?.data?.quizzes || [];
  const error = quizzesError ? 'Failed to load quizzes' : null;
  const isLoading = isLoadingQuizzes || isDeletingQuiz;

  // Handlers
  const handleQuizClick = (quizId: string) => {
    navigate(`/quiz/${quizId}`);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      try {
        const result = await deleteQuizMutation({ quizId }).unwrap();
        if (result.success) {
          // Refetch quizzes after successful deletion
          refetchQuizzes();
        }
        // Success feedback could be added here (toast notification, etc.)
      } catch (error) {
        // Error feedback could be added here
        console.error('Failed to delete quiz:', error);
        alert('Failed to delete quiz. Please try again.');
      }
    }
  };

  const handleRefresh = () => {
    refetchQuizzes();
  };

  const handlers = {
    handleQuizClick,
    handleDeleteQuiz,
    handleRefresh,
  };

  // Group quizzes by document title
  const groupedQuizzes: GroupedQuizzes = useMemo(() => {
    return quizzes.reduce((acc, quiz) => {
      const documentTitle = quiz.documentTitle || 'Unknown Document';
      if (!acc[documentTitle]) {
        acc[documentTitle] = [];
      }
      acc[documentTitle].push(quiz);
      return acc;
    }, {} as GroupedQuizzes);
  }, [quizzes]);

  const contextValue = {
    quizzes,
    groupedQuizzes,
    isLoading,
    error,
    handlers,
  };

  return (
    <MyQuizzesPageContext.Provider value={contextValue}>
      {children}
    </MyQuizzesPageContext.Provider>
  );
};