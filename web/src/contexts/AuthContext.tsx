import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { User } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthContextType {
  user: User | null | undefined;
  loading: boolean;
  error?: Error;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, loading, error] = useAuthState(auth);

  const value: AuthContextType = {
    user,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};