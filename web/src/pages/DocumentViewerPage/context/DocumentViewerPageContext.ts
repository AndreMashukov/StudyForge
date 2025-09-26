import { createContext } from 'react';
import { IDocumentViewerPageContext } from '../types/IDocumentViewerPageContext';

export const DocumentViewerPageContext = createContext<IDocumentViewerPageContext | null>(null);