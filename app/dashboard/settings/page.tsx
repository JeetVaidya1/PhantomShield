'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';

interface AliasUsage {
  total: number;
  active: number;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 5))}@${domain}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { username, planTier, logout } = useAuth();
  const [aliasUsage, setAliasUsage] = useState<AliasUsage>({ total: 0, active: 0 });
  const [loading, setLoading] = useState(true);

  // Forwarding email state
  const [forwardingEmail, setForwardingEmail] = useState<string | null>(null);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const maxAliases = planTier === 'pro' ? 15 : 3;
  const maxPhones = planTier === 'pro' ? 2 : 0;

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v2/aliases');
      if (!res.ok) {
        if (res.status === 401) { router.push('/'); return; }
        return;
      }
      const data = await res.json();
      const aliases = data.aliases || [];
      setAliasUsage({
        total: aliases.length,
        active: aliases.filter((a: { status: string }) => a.status === 'active').length,
      });
      // Try to get forwarding email from the first alias
      if (aliases.length > 0 && aliases[0].forwarding_email) {
        setForwardingEmail(aliases[0].forwarding_email);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveEmail = async () => {
    if (!newEmail.trim()) return;
    setSavingEmail(true);
    setEmailError(null);
    setEmailSuccess(false);
    try {
      const res = await apiFetch('/api/v2/settings/forwarding', {
        method: 'PUT',
        body: JSON.stringify({ forwarding_email: newEmail.trim() }),
      });
      if (res.ok) {
        setForwardingEmail(newEmail.trim());
        setShowChangeEmail(false);
        setNewEmail('');
        setEmailSuccess(true);
        setTimeout(() => setEmailSuccess(false), 3000);
      } else {
        const data = await res.json();
        setEmailError(data.error || 'Failed to update forwarding email');
      }
    } catch {
      setEmailError('Network error');
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <div className="border-b border-[#1f2937]">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-[#e2e8f0]">Settings</h1>
          <p className="text-sm text-[#64748b] mt-1">Account, plan, and preferences</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* ---- Account Section ---- */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg card-glow">
          <div className="px-5 py-4 border-b border-[#1f2937]">
            <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider">Account</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748b] mb-1">Username</p>
                <p className="text-base font-medium text-[#e2e8f0]">{username || 'Anonymous'}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase ${
                planTier === 'pro'
                  ? 'bg-[#6366f1]/10 text-[#6366f1]'
                  : 'bg-[#1f2937] text-[#94a3b8]'
              }`}>
                {planTier}
              </span>
            </div>
          </div>
        </div>

        {/* ---- Forwarding Email Section ---- */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg card-glow">
          <div className="px-5 py-4 border-b border-[#1f2937]">
            <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider">Forwarding Email</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            {loading ? (
              <div className="h-5 w-48 bg-[#1f2937] rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-mono text-[#e2e8f0]">
                      {forwardingEmail ? maskEmail(forwardingEmail) : 'Not set'}
                    </p>
                  </div>
                  {!showChangeEmail && (
                    <button
                      onClick={() => setShowChangeEmail(true)}
                      className="text-sm font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors"
                    >
                      Change
                    </button>
                  )}
                </div>

                {/* Inline edit form */}
                {showChangeEmail && (
                  <div className="space-y-3">
                    <div>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="new-email@example.com"
                        className="w-full rounded-lg bg-[#0a0e17] border border-[#1f2937] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-colors"
                      />
                    </div>
                    {emailError && (
                      <p className="text-xs text-[#ef4444]">{emailError}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveEmail}
                        disabled={savingEmail || !newEmail.trim()}
                        className="bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2"
                      >
                        {savingEmail && (
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        )}
                        Save
                      </button>
                      <button
                        onClick={() => { setShowChangeEmail(false); setNewEmail(''); setEmailError(null); }}
                        className="text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {emailSuccess && (
                  <p className="text-xs text-[#22c55e]">Forwarding email updated.</p>
                )}

                <div className="flex items-start gap-2 pt-1">
                  <svg className="w-4 h-4 text-[#64748b] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-xs text-[#64748b] leading-relaxed">
                    Your forwarding email is encrypted -- we can't see it.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---- Plan Details Section ---- */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg card-glow">
          <div className="px-5 py-4 border-b border-[#1f2937]">
            <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider">Plan Details</h2>
          </div>
          <div className="px-5 py-4 space-y-5">
            {/* Current plan */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase ${
                  planTier === 'pro'
                    ? 'bg-[#6366f1]/10 text-[#6366f1]'
                    : 'bg-[#1f2937] text-[#94a3b8]'
                }`}>
                  {planTier}
                </span>
                <span className="text-sm text-[#e2e8f0] font-medium">
                  {planTier === 'pro' ? 'Phantom Pro' : 'Phantom Free'}
                </span>
              </div>
            </div>

            {/* Features list */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#22c55e] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-[#94a3b8]">
                  {maxAliases} email aliases
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg className={`w-4 h-4 flex-shrink-0 ${planTier === 'pro' ? 'text-[#22c55e]' : 'text-[#64748b]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {planTier === 'pro' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
                <span className="text-sm text-[#94a3b8]">
                  {maxPhones} phone numbers
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#22c55e] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-[#94a3b8]">Tracker stripping</span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#22c55e] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-[#94a3b8]">Leak detection</span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#22c55e] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-[#94a3b8]">GDPR deletion requests</span>
              </div>
            </div>

            {/* Usage */}
            <div className="space-y-3 pt-2 border-t border-[#1f2937]">
              <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Usage</h3>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-[#94a3b8]">Email Aliases</span>
                  <span className="text-sm font-mono tabular-nums text-[#e2e8f0]">
                    {loading ? '-' : aliasUsage.active}/{maxAliases}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#0a0e17] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      aliasUsage.active >= maxAliases ? 'bg-[#f59e0b]' : 'bg-[#6366f1]'
                    }`}
                    style={{ width: loading ? '0%' : `${Math.min((aliasUsage.active / maxAliases) * 100, 100)}%` }}
                  />
                </div>
                {aliasUsage.active >= maxAliases && (
                  <p className="text-xs text-[#f59e0b] mt-1.5">
                    {planTier === 'free' ? 'Upgrade to Pro for more aliases' : 'Maximum aliases reached'}
                  </p>
                )}
              </div>
            </div>

            {/* Upgrade CTA */}
            {planTier === 'free' && (
              <Link
                href="/dashboard/upgrade"
                className="block w-full text-center bg-[#6366f1] hover:bg-[#5558e6] text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Upgrade to Pro
              </Link>
            )}
          </div>
        </div>

        {/* ---- Danger Zone ---- */}
        <div className="bg-[#111827] border border-[#ef4444]/30 rounded-lg">
          <div className="px-5 py-4 border-b border-[#ef4444]/20">
            <h2 className="text-sm font-semibold text-[#ef4444] uppercase tracking-wider">Danger Zone</h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-[#94a3b8] mb-4">
              Permanently destroy all your identities, data, and account. This sends GDPR deletion requests to all services and soft-deletes your account for 30 days.
            </p>
            <Link
              href="/dashboard/nuke"
              className="inline-flex items-center gap-2 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/30 text-[#ef4444] font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Account
            </Link>
          </div>
        </div>

        {/* ---- Links ---- */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg card-glow">
          <div className="px-5 py-4 border-b border-[#1f2937]">
            <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider">Links</h2>
          </div>
          <div className="divide-y divide-[#1f2937]">
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-5 py-3.5 hover:bg-[#0a0e17]/40 transition-colors group"
            >
              <span className="text-sm text-[#e2e8f0] group-hover:text-[#6366f1] transition-colors">Privacy Policy</span>
              <svg className="w-4 h-4 text-[#64748b] group-hover:text-[#6366f1] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-5 py-3.5 hover:bg-[#0a0e17]/40 transition-colors group"
            >
              <span className="text-sm text-[#e2e8f0] group-hover:text-[#6366f1] transition-colors">Terms of Service</span>
              <svg className="w-4 h-4 text-[#64748b] group-hover:text-[#6366f1] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <Link
              href="/dashboard/export"
              className="flex items-center justify-between px-5 py-3.5 hover:bg-[#0a0e17]/40 transition-colors group"
            >
              <span className="text-sm text-[#e2e8f0] group-hover:text-[#6366f1] transition-colors">Export Data</span>
              <svg className="w-4 h-4 text-[#64748b] group-hover:text-[#6366f1] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => { logout(); router.push('/'); }}
          className="w-full bg-[#111827] border border-[#1f2937] hover:border-[#374151] rounded-lg px-5 py-3.5 text-sm font-medium text-[#94a3b8] hover:text-[#e2e8f0] transition-colors card-glow"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
