import { createContext } from 'react';
import { ICreateSubjectWorldPageContext } from '../types/ICreateSubjectWorldPageContext';

export const CreateSubjectWorldPageContext = createContext<
  ICreateSubjectWorldPageContext | undefined
>(undefined);
