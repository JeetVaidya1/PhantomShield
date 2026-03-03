'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth-context';

function AuthForm() {
  const router = useRouter();
  const { login, signup, token } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('signup');
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
    <div className="min-h-screen bg-[#0a0e17] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[#1f2937]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6366f1] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-[#e2e8f0]">Phantom Defender</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#e2e8f0] tracking-tight">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="mt-2 text-[#94a3b8]">
              {mode === 'login' ? 'Log in to your command center' : 'Set up your privacy command center'}
            </p>
            <p className="mt-1 text-sm text-[#64748b]">
              No email required. Zero-knowledge encryption.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-[10px] font-semibold tracking-wider uppercase text-[#64748b] mb-1.5">
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
                className="w-full rounded-lg border border-[#1f2937] bg-[#111827] px-4 py-3 text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] font-semibold tracking-wider uppercase text-[#64748b] mb-1.5">
                Master Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your master password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full rounded-lg border border-[#1f2937] bg-[#111827] px-4 py-3 text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors"
              />
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="confirm-password" className="block text-[10px] font-semibold tracking-wider uppercase text-[#64748b] mb-1.5">
                    Confirm Master Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your master password"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-[#1f2937] bg-[#111827] px-4 py-3 text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors"
                  />
                </div>
                <div className="rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 px-4 py-3">
                  <p className="text-xs text-[#f59e0b] leading-relaxed">
                    Your master password encrypts all your data. If you forget it, your data cannot be recovered.
                  </p>
                </div>
              </>
            )}

            {error && (
              <div className="rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 px-4 py-3">
                <p className="text-sm text-[#ef4444] text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3.5 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                mode === 'login' ? 'Log In' : 'Create Account'
              )}
            </button>

            <button
              type="button"
              onClick={toggleMode}
              className="w-full text-center text-sm text-[#6366f1] hover:text-[#818cf8] transition-colors py-2"
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </button>
          </form>
        </div>
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
