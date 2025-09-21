import React from 'react';
import { ICreateDocumentPageContext } from '../types/ICreateDocumentPageContext';

export const CreateDocumentPageContext = React.createContext<ICreateDocumentPageContext | undefined>(undefined);