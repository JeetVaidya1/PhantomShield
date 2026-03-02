'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';

type Step = 'idle' | 'preview' | 'confirm' | 'loading' | 'done';

interface NukePreview {
  alias_count: number;
  phone_count: number;
  honeypot_count: number;
  gdpr_eligible: number;
}

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
  const [preview, setPreview] = useState<NukePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await apiFetch('/api/v2/aliases');
      if (res.ok) {
        const data = await res.json();
        const aliases = data.aliases || [];
        const active = aliases.filter((a: { status: string }) => a.status === 'active');
        setPreview({
          alias_count: active.length,
          phone_count: 0,
          honeypot_count: aliases.filter((a: { is_honeypot: boolean }) => a.is_honeypot).length,
          gdpr_eligible: Math.max(active.length, 1),
        });
      }
    } catch {
      // Use fallback counts
      setPreview({ alias_count: 0, phone_count: 0, honeypot_count: 0, gdpr_eligible: 0 });
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

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
        headers: { 'x-biometric-token': 'web-confirmed' },
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

  // --- DONE STATE ---
  if (step === 'done' && result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-lg">
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-[#e2e8f0] mb-2">
              Account Nuked
            </h2>
            <p className="text-[#94a3b8] text-sm mb-8">
              30 days to recover.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-[#0a0e17] rounded-xl p-4 border border-[#1f2937]">
                <p className="text-2xl font-bold font-mono tabular-nums text-[#e2e8f0]">
                  {result.identities_killed}
                </p>
                <p className="text-xs text-[#64748b] mt-1">Identities killed</p>
              </div>
              <div className="bg-[#0a0e17] rounded-xl p-4 border border-[#1f2937]">
                <p className="text-2xl font-bold font-mono tabular-nums text-[#e2e8f0]">
                  {result.gdpr_emails_sent}
                </p>
                <p className="text-xs text-[#64748b] mt-1">Deletion requests sent</p>
              </div>
            </div>

            <div className="bg-[#f59e0b]/5 border border-[#f59e0b]/10 rounded-xl px-4 py-3 mb-8">
              <p className="text-xs text-[#f59e0b]">
                Recoverable until {new Date(result.recovery_deadline).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full bg-[#6366f1] hover:bg-[#5558e6] text-white font-semibold py-3.5 px-6 rounded-xl transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- LOADING STATE ---
  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-lg text-center">
          <div className="w-16 h-16 border-4 border-[#ef4444] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-xl font-bold text-[#ef4444] mb-2">
            Executing Emergency Nuke
          </p>
          <p className="text-sm text-[#ef4444]/60">
            Killing identities and dispatching deletion requests...
          </p>
          <div className="mt-8 space-y-2">
            {['Deactivating aliases', 'Releasing phone numbers', 'Sending GDPR requests', 'Wiping account data'].map((task, i) => (
              <div key={task} className="flex items-center gap-3 justify-center">
                <div
                  className="w-4 h-4 border-2 border-[#ef4444]/40 border-t-[#ef4444] rounded-full animate-spin"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
                <span className="text-sm text-[#94a3b8]">{task}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- CONFIRM STATE ---
  if (step === 'confirm') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-lg">
          <div className="bg-[#1c1117] border-2 border-[#ef4444]/30 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#ef4444]/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[#ef4444]">
                Final Confirmation
              </h2>
            </div>

            <p className="text-sm text-[#94a3b8] leading-relaxed mb-6">
              This action cannot be easily reversed. All active identities will be deactivated and GDPR deletion requests will be dispatched. Type <span className="font-bold text-[#ef4444]">NUKE</span> below to confirm.
            </p>

            <label className="block text-xs font-medium text-[#64748b] uppercase tracking-wider mb-2">
              Type NUKE to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="NUKE"
              className="w-full bg-[#0a0e17] border border-[#ef4444]/20 rounded-xl px-4 py-4 text-center text-2xl font-bold font-mono tracking-[0.5em] text-[#ef4444] placeholder:text-[#1f2937] placeholder:tracking-[0.5em] focus:outline-none focus:border-[#ef4444]/50 focus:ring-1 focus:ring-[#ef4444]/30 transition"
              autoComplete="off"
              spellCheck={false}
            />

            <div className="flex gap-3 mt-8">
              <button
                onClick={handleCancel}
                className="flex-1 bg-[#111827] border border-[#1f2937] hover:border-[#374151] text-[#94a3b8] font-semibold py-3.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteNuke}
                disabled={confirmText !== 'NUKE'}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] disabled:bg-[#ef4444]/10 disabled:text-[#ef4444]/30 disabled:border disabled:border-[#ef4444]/10 text-white font-extrabold py-3.5 rounded-xl transition-all disabled:cursor-not-allowed"
              >
                EXECUTE NUKE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- PREVIEW STATE ---
  if (step === 'preview') {
    const totalImpact = (preview?.alias_count ?? 0) + (preview?.phone_count ?? 0) + (preview?.honeypot_count ?? 0);
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-lg">
          <div className="bg-[#1c1117] border-2 border-[#ef4444]/20 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#ef4444]/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#ef4444]">
                  Impact Preview
                </h2>
                <p className="text-xs text-[#64748b]">Review what will be destroyed</p>
              </div>
            </div>

            {previewLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-3 border-[#ef4444]/30 border-t-[#ef4444] rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <ImpactCard label="Aliases killed" value={preview?.alias_count ?? 0} />
                  <ImpactCard label="Phones released" value={preview?.phone_count ?? 0} />
                  <ImpactCard label="Honeypots destroyed" value={preview?.honeypot_count ?? 0} />
                  <ImpactCard label="GDPR requests sent" value={preview?.gdpr_eligible ?? 0} />
                </div>

                <div className="bg-[#0a0e17] border border-[#ef4444]/10 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#64748b] uppercase tracking-wider">Total impact</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-[#ef4444]">{totalImpact} identities</span>
                  </div>
                  <div className="w-full h-2 bg-[#1f2937] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#ef4444] to-[#f59e0b] rounded-full transition-all duration-500" style={{ width: '100%' }} />
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <p className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">This will:</p>
                  {[
                    'Deactivate all active email aliases',
                    'Release all phone numbers',
                    'Send GDPR deletion requests to all services',
                    'Soft-delete your account (30-day recovery)',
                  ].map((action) => (
                    <div key={action} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] mt-1.5 shrink-0" />
                      <span className="text-sm text-[#94a3b8]">{action}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 bg-[#111827] border border-[#1f2937] hover:border-[#374151] text-[#94a3b8] font-semibold py-3.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToConfirm}
                disabled={previewLoading}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- IDLE STATE ---
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e2e8f0]">Emergency</h1>
          <p className="text-sm text-[#64748b] mt-0.5">Danger zone controls</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">
          DANGER
        </span>
      </div>

      {error && (
        <div className="bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-[#ef4444] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-[#ef4444]">{error}</p>
        </div>
      )}

      {/* Warning Banner */}
      <div className="bg-[#1c1117] border border-[#ef4444]/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#ef4444]/10 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#ef4444] mb-1">
              EMERGENCY NUKE
            </h2>
            <p className="text-sm text-[#94a3b8] leading-relaxed">
              Instantly kill all identities, send deletion requests to every service, and wipe your account. Use only when you believe your data has been critically compromised. Your account will be recoverable for 30 days.
            </p>
          </div>
        </div>

        {/* Impact preview in idle */}
        {preview && !previewLoading && (
          <div className="grid grid-cols-4 gap-2 mt-6 pt-6 border-t border-[#ef4444]/10">
            <MiniStat label="Aliases" value={preview.alias_count} />
            <MiniStat label="Phones" value={preview.phone_count} />
            <MiniStat label="Honeypots" value={preview.honeypot_count} />
            <MiniStat label="GDPR" value={preview.gdpr_eligible} />
          </div>
        )}

        <button
          onClick={handleInitiate}
          className="w-full mt-6 bg-[#ef4444] hover:bg-[#dc2626] active:bg-[#b91c1c] text-white text-lg font-extrabold py-4 rounded-xl tracking-wide transition-colors"
        >
          NUKE EVERYTHING
        </button>
      </div>

      {/* Process Explanation */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 card-glow">
        <h3 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-4">
          What happens during a nuke
        </h3>
        <div className="space-y-3">
          {[
            { step: '01', text: 'All email aliases are deactivated' },
            { step: '02', text: 'All phone numbers are released' },
            { step: '03', text: 'GDPR deletion emails sent to all known services' },
            { step: '04', text: 'Your account is soft-deleted' },
            { step: '05', text: '30-day recovery window begins' },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#0a0e17] border border-[#1f2937] flex items-center justify-center text-xs font-mono font-bold text-[#64748b]">
                {item.step}
              </span>
              <span className="text-sm text-[#94a3b8]">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recovery Notice */}
      <div className="bg-[#0a0e17] border border-[#1f2937] rounded-xl px-4 py-3 flex items-center gap-3">
        <svg className="w-4 h-4 text-[#f59e0b] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-[#64748b]">
          After nuking, you have 30 days to recover your account by logging back in. After 30 days, all data is permanently destroyed.
        </p>
      </div>
    </div>
  );
}

function ImpactCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#0a0e17] border border-[#ef4444]/10 rounded-xl p-4 text-center">
      <p className="text-3xl font-bold font-mono tabular-nums text-[#ef4444]">
        {value}
      </p>
      <p className="text-xs text-[#64748b] mt-1">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold font-mono tabular-nums text-[#ef4444]/80">{value}</p>
      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">{label}</p>
    </div>
  );
}
