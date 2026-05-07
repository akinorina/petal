'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  getAccessToken,
  getCurrentUserEmail,
  setCurrentUserEmail,
} from '@/lib/cognito';
import {
  useAuthApi,
  type LoginResult,
} from '@/lib/api-hooks/use-auth-api';

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
  logout: () => Promise<void>;
  updateEmail: (newEmail: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const api = useAuthApi();
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

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password);
      if (result.kind === 'authenticated') {
        setState({
          isAuthenticated: true,
          email: result.email,
          isLoading: false,
        });
      }
      return result;
    },
    [api],
  );

  const completeNewPassword = useCallback(
    async (email: string, newPassword: string, session: string) => {
      await api.completeNewPassword(email, newPassword, session);
      setState({ isAuthenticated: true, email, isLoading: false });
    },
    [api],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setState({ isAuthenticated: false, email: null, isLoading: false });
  }, [api]);

  const updateEmail = useCallback((newEmail: string) => {
    setCurrentUserEmail(newEmail);
    setState((prev) => ({ ...prev, email: newEmail }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, completeNewPassword, logout, updateEmail }}
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
