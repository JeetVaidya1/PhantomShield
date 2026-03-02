'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth-context';

function AuthForm() {
  const router = useRouter();
  const { login, signup, token } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  if (token) {
    router.push('/dashboard');
    return null;
  }

  const validate = (): string | null => {
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(username))
      return 'Username: letters, numbers, hyphens, underscores only';
    if (password.length < 8) return 'Master password must be at least 8 characters';
    if (mode === 'signup' && password !== confirmPassword)
      return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        await signup(username, password);
      } else {
        await login(username, password);
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-phantom-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-phantom-text-primary tracking-tight">
            Phantom Defender
          </h1>
          <p className="mt-2 text-phantom-text-secondary">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
          <p className="mt-1 text-sm text-phantom-text-muted">
            No email required. Your data stays encrypted.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-phantom-text-secondary mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className="w-full rounded-lg border border-phantom-border bg-phantom-card px-4 py-3 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors"
            />
          </div>

          {/* Master Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-phantom-text-secondary mb-1.5"
            >
              Master Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your master password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full rounded-lg border border-phantom-border bg-phantom-card px-4 py-3 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors"
            />
          </div>

          {/* Confirm Password (signup only) */}
          {mode === 'signup' && (
            <>
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-semibold text-phantom-text-secondary mb-1.5"
                >
                  Confirm Master Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your master password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-phantom-border bg-phantom-card px-4 py-3 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors"
                />
              </div>
              <div className="rounded-lg bg-phantom-warning-bg/40 border border-amber-600/30 px-4 py-3">
                <p className="text-xs text-amber-300 leading-relaxed">
                  Your master password encrypts all your data. If you forget it, your data cannot be recovered.
                </p>
              </div>
            </>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-lg bg-phantom-danger-surface px-4 py-3">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-phantom-accent hover:bg-phantom-accent-hover disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3.5 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              mode === 'login' ? 'Log In' : 'Create Account'
            )}
          </button>

          {/* Toggle mode */}
          <button
            type="button"
            onClick={toggleMode}
            className="w-full text-center text-sm text-phantom-accent hover:text-phantom-accent-hover transition-colors py-2"
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <AuthProvider>
      <AuthForm />
    </AuthProvider>
  );
}
