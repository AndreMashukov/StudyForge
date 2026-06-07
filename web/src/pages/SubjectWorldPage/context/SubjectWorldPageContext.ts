import { createContext } from 'react';
import { ISubjectWorldPageContext } from '../types/ISubjectWorldPageContext';

export const SubjectWorldPageContext = createContext<ISubjectWorldPageContext | undefined>(undefined);
