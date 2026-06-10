'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  AUTH_CLEARED_EVENT,
  getAccessToken,
  getCurrentUserEmail,
  setCurrentUserEmail,
} from '@/lib/auth-session';
import {
  useAuthApi,
  type LoginResult,
} from '@/lib/api-hooks/use-auth-api';
import { useCurrentUserApi } from '@/lib/api-hooks/use-me-api';
import type { Schemas } from '@/lib/openapi/client';

type UserRole = Schemas['UserRole'];

type AuthState = {
  isAuthenticated: boolean;
  email: string | null;
  role: UserRole | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<LoginResult>;
  completeNewPassword: (
    email: string,
    newPassword: string,
    session: string,
  ) => Promise<void>;
  respondMfaChallenge: (
    email: string,
    code: string,
    session: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateEmail: (newEmail: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const api = useAuthApi();
  const { findMe } = useCurrentUserApi();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    email: null,
    role: null,
    isLoading: true,
  });

  // 現在のユーザーのロールを取得する。失敗時は null（一般ユーザー相当に倒す）。
  const fetchRole = useCallback(async (): Promise<UserRole | null> => {
    try {
      const me = await findMe();
      return me.role;
    } catch {
      return null;
    }
  }, [findMe]);

  useEffect(() => {
    getAccessToken().then(async (token) => {
      if (!token) {
        setState({
          isAuthenticated: false,
          email: null,
          role: null,
          isLoading: false,
        });
        return;
      }
      const role = await fetchRole();
      setState({
        isAuthenticated: true,
        email: getCurrentUserEmail(),
        role,
        isLoading: false,
      });
    });
  }, [fetchRole]);

  useEffect(() => {
    const handler = () =>
      setState({
        isAuthenticated: false,
        email: null,
        role: null,
        isLoading: false,
      });
    window.addEventListener(AUTH_CLEARED_EVENT, handler);
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, handler);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password);
      if (result.kind === 'authenticated') {
        const role = await fetchRole();
        setState({
          isAuthenticated: true,
          email: result.email,
          role,
          isLoading: false,
        });
      }
      return result;
    },
    [api, fetchRole],
  );

  const completeNewPassword = useCallback(
    async (email: string, newPassword: string, session: string) => {
      await api.completeNewPassword(email, newPassword, session);
      const role = await fetchRole();
      setState({ isAuthenticated: true, email, role, isLoading: false });
    },
    [api, fetchRole],
  );

  const respondMfaChallenge = useCallback(
    async (email: string, code: string, session: string) => {
      await api.respondMfaChallenge(email, code, session);
      const role = await fetchRole();
      setState({ isAuthenticated: true, email, role, isLoading: false });
    },
    [api, fetchRole],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setState({
      isAuthenticated: false,
      email: null,
      role: null,
      isLoading: false,
    });
  }, [api]);

  const updateEmail = useCallback((newEmail: string) => {
    setCurrentUserEmail(newEmail);
    setState((prev) => ({ ...prev, email: newEmail }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        completeNewPassword,
        respondMfaChallenge,
        logout,
        updateEmail,
      }}
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
