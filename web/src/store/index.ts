import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import quizPageReducer from './slices/quizPageSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    quizPage: quizPageReducer,
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