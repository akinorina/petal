'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  completeNewPassword as cognitoCompleteNewPassword,
  getCurrentUserEmail,
  getAccessToken,
  login as cognitoLogin,
  logout as cognitoLogout,
  type LoginResult,
} from '@/lib/cognito';

type AuthState = {
  isAuthenticated: boolean;
  email: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<LoginResult>;
  completeNewPassword: (
    email: string,
    newPassword: string,
    session: string,
  ) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    email: null,
    isLoading: true,
  });

  useEffect(() => {
    getAccessToken().then((token) => {
      setState({
        isAuthenticated: !!token,
        email: token ? getCurrentUserEmail() : null,
        isLoading: false,
      });
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await cognitoLogin(email, password);
    if (result.kind === 'authenticated') {
      setState({ isAuthenticated: true, email: result.email, isLoading: false });
    }
    return result;
  }, []);

  const completeNewPassword = useCallback(
    async (email: string, newPassword: string, session: string) => {
      await cognitoCompleteNewPassword(email, newPassword, session);
      setState({ isAuthenticated: true, email, isLoading: false });
    },
    [],
  );

  const logout = useCallback(() => {
    cognitoLogout();
    setState({ isAuthenticated: false, email: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, completeNewPassword, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
