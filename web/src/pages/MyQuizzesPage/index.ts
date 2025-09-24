export { MyQuizzesPage } from './MyQuizzesPage';

// Also export context and types for potential reuse
export { MyQuizzesPageProvider } from './context/MyQuizzesPageProvider';
export { useMyQuizzesPageContext } from './context/hooks/useMyQuizzesPageContext';
export type { 
  IMyQuizzesPageContext, 
  GroupedQuizzes, 
  QuizCardProps, 
  DocumentGroupProps 
} from './types/IMyQuizzesPageTypes';