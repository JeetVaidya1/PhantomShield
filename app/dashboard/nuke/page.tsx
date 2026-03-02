'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';

type Step = 'idle' | 'preview' | 'confirm' | 'loading' | 'done';

interface NukeResult {
  identities_killed: number;
  gdpr_emails_sent: number;
  recovery_deadline: string;
}

export default function NukePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<NukeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInitiate = () => {
    setStep('preview');
    setError(null);
  };

  const handleCancel = () => {
    setStep('idle');
    setConfirmText('');
    setError(null);
  };

  const handleProceedToConfirm = () => {
    setStep('confirm');
  };

  const handleExecuteNuke = async () => {
    if (confirmText !== 'NUKE') return;
    setStep('loading');
    setError(null);

    try {
      const res = await apiFetch('/api/v2/nuke', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
        headers: {
          'x-biometric-token': 'web-confirmed',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setStep('done');
      } else {
        const err = await res.json();
        setError(err.error || 'Nuke failed. Please try again.');
        setStep('idle');
      }
    } catch {
      setError('Network error. Failed to execute nuke.');
      setStep('idle');
    }
  };

  const handleSignOut = () => {
    logout();
    router.push('/');
  };

  // --- DONE ---
  if (step === 'done' && result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-md bg-[#1E1B4B] rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold text-[#E0E7FF] mb-6">
            Nuke Complete
          </h2>

          <div className="space-y-2 mb-6">
            <p className="text-lg text-[#A5B4FC]">
              {result.identities_killed} identities killed
            </p>
            <p className="text-lg text-[#A5B4FC]">
              {result.gdpr_emails_sent} deletion requests sent
            </p>
          </div>

          <p className="text-sm text-amber-300 mb-8 leading-relaxed">
            Account recoverable until
            <br />
            {new Date(result.recovery_deadline).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>

          <button
            onClick={handleSignOut}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // --- LOADING ---
  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-lg font-semibold text-red-400">
          Executing emergency nuke...
        </p>
        <p className="text-sm text-red-300/70 mt-2">
          Killing identities and sending deletion requests
        </p>
      </div>
    );
  }

  // --- CONFIRM ---
  if (step === 'confirm') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-md bg-[#2D0A0A] border-2 border-red-500 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-red-500 text-center mb-6">
            Final Confirmation
          </h2>

          <p className="text-red-300 text-sm mb-6 text-center leading-relaxed">
            This action is irreversible. Type <span className="font-bold text-red-400">NUKE</span> below to confirm you want to destroy all identities and wipe your account.
          </p>

          <label className="block text-sm text-red-300/80 mb-2">
            Type NUKE to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder="NUKE"
            className="w-full bg-[#1E1B4B] border border-red-900 rounded-lg px-4 py-3.5 text-center text-xl font-bold text-red-400 tracking-[0.5em] placeholder:text-gray-600 placeholder:tracking-[0.5em] focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCancel}
              className="flex-1 bg-[#312E81] hover:bg-[#3730A3] text-[#A5B4FC] font-semibold py-3.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteNuke}
              disabled={confirmText !== 'NUKE'}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-950 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              EXECUTE NUKE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PREVIEW ---
  if (step === 'preview') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-md bg-[#2D0A0A] border-2 border-red-500 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-red-500 text-center mb-4">
            Emergency Nuke
          </h2>

          <p className="text-red-300 mb-3 font-medium">
            This will:
          </p>

          <ul className="space-y-2 mb-6">
            <li className="text-red-200 text-[15px] pl-2">
              <span className="mr-2">&#8226;</span>
              Kill all active email aliases
            </li>
            <li className="text-red-200 text-[15px] pl-2">
              <span className="mr-2">&#8226;</span>
              Release all phone numbers
            </li>
            <li className="text-red-200 text-[15px] pl-2">
              <span className="mr-2">&#8226;</span>
              Send GDPR deletion requests to all services
            </li>
            <li className="text-red-200 text-[15px] pl-2">
              <span className="mr-2">&#8226;</span>
              Soft-delete your account (recoverable 30 days)
            </li>
          </ul>

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 bg-[#312E81] hover:bg-[#3730A3] text-[#A5B4FC] font-semibold py-3.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleProceedToConfirm}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors"
            >
              I Understand, Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- IDLE ---
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#E0E7FF]">Emergency</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-[#2D0A0A] border border-red-900 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-red-500 mb-3">
          Emergency Nuke
        </h2>
        <p className="text-red-300/80 text-sm leading-relaxed mb-6">
          Instantly kill all identities, send deletion requests to every service,
          and wipe your account. Use only in an emergency. Your account will be
          recoverable for 30 days.
        </p>

        <button
          onClick={handleInitiate}
          className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-lg font-extrabold py-4 rounded-xl tracking-wide transition-colors"
        >
          NUKE EVERYTHING
        </button>
      </div>

      <div className="bg-[#1E1B4B] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[#A5B4FC] mb-2">
          What happens during a nuke?
        </h3>
        <ul className="space-y-1.5 text-sm text-[#818CF8]">
          <li>1. All email aliases are deactivated</li>
          <li>2. All phone numbers are released</li>
          <li>3. GDPR deletion emails sent to all known services</li>
          <li>4. Your account is soft-deleted</li>
          <li>5. You have 30 days to recover before permanent deletion</li>
        </ul>
      </div>
    </div>
  );
}
