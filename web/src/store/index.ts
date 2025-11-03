import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import quizPageReducer from './slices/quizPageSlice';
import documentsPageReducer from './slices/documentsPageSlice';
import documentViewerPageReducer from './slices/documentViewerPageSlice';
import createDocumentPageReducer from './slices/createDocumentPageSlice';
import rulesReducer from './slices/rulesSlice';
import directoryReducer from './slices/directorySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    quizPage: quizPageReducer,
    documentsPage: documentsPageReducer,
    documentViewerPage: documentViewerPageReducer,
    createDocumentPage: createDocumentPageReducer,
    rules: rulesReducer,
    directory: directoryReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          // Ignore Firebase User objects in Redux state
          'auth/setUser',
        ],
        ignoredPaths: ['auth.user'],
      },
    }).concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;