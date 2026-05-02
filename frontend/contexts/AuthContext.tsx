'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  getCurrentUserEmail,
  getAccessToken,
  login as cognitoLogin,
  logout as cognitoLogout,
} from '@/lib/cognito';

type AuthState = {
  isAuthenticated: boolean;
  email: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
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
    // 起動時にセッションの有効性を確認
    getAccessToken().then((token) => {
      setState({
        isAuthenticated: !!token,
        email: token ? getCurrentUserEmail() : null,
        isLoading: false,
      });
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await cognitoLogin(email, password);
    setState({ isAuthenticated: true, email, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    cognitoLogout();
    setState({ isAuthenticated: false, email: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
