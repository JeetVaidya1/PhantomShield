'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  userId: string | null;
  username: string | null;
  encryptionSalt: string | null;
  planTier: 'free' | 'pro';
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => void;
  getToken: () => string | null;
  setPlanTier: (tier: 'free' | 'pro') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'phantom_auth';

function saveAuth(state: Partial<AuthState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Set a cookie for middleware auth checks
    document.cookie = `phantom_token=${state.token || ''}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  } catch {}
}

function loadAuth(): Partial<AuthState> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function clearAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = 'phantom_token=; path=/; max-age=0';
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    refreshToken: null,
    userId: null,
    username: null,
    encryptionSalt: null,
    planTier: 'free',
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = loadAuth();
    if (stored?.token) {
      setState((prev) => ({ ...prev, ...stored } as AuthState));
    }
    setLoaded(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.toLowerCase(), password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    const newState: AuthState = {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      userId: data.user.id,
      username: data.user.username,
      encryptionSalt: data.user.encryption_salt,
      planTier: 'free', // Will be fetched from user_settings
    };
    setState(newState);
    saveAuth(newState);
  }, []);

  const signup = useCallback(async (username: string, password: string) => {
    const saltArray = new Uint8Array(32);
    crypto.getRandomValues(saltArray);
    const encryptionSalt = Array.from(saltArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.toLowerCase(),
        password,
        encryption_salt: encryptionSalt,
        key_check: 'pending-client-crypto',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');

    if (data.session) {
      const newState: AuthState = {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        userId: data.user.id,
        username: data.user.username,
        encryptionSalt,
        planTier: 'free',
      };
      setState(newState);
      saveAuth(newState);
    } else {
      throw new Error('Account created. Please log in.');
    }
  }, []);

  const logout = useCallback(() => {
    setState({
      token: null,
      refreshToken: null,
      userId: null,
      username: null,
      encryptionSalt: null,
      planTier: 'free',
    });
    clearAuth();
  }, []);

  const getToken = useCallback(() => state.token, [state.token]);

  const setPlanTier = useCallback((tier: 'free' | 'pro') => {
    setState((prev) => {
      const updated = { ...prev, planTier: tier };
      saveAuth(updated);
      return updated;
    });
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-phantom-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-phantom-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ ...state, login, signup, logout, getToken, setPlanTier }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
