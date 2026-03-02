'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';

interface PhoneNumber {
  id: string;
  phone_number: string;
  status: 'active' | 'released';
  created_at: string;
}

interface SMSMessage {
  id: string;
  from: string;
  body: string;
  received_at: string;
  extracted_code?: string | null;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function extractOTPCode(body: string): string | null {
  const match = body.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ */
/*  Free-tier upgrade prompt                                          */
/* ------------------------------------------------------------------ */
function FreeUpgradePrompt() {
  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <div className="border-b border-[#1f2937]">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-[#e2e8f0]">Phone Numbers</h1>
          <p className="text-sm text-[#64748b] mt-1">Receive-only burner numbers</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg overflow-hidden card-glow">
          <div className="px-6 py-5 border-b border-[#1f2937]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-[#6366f1]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#6366f1] uppercase">
                Pro
              </span>
              <h2 className="text-lg font-bold text-[#e2e8f0]">Burner Phones</h2>
            </div>
            <p className="text-sm text-[#94a3b8] mt-2">
              Receive-only phone numbers for OTP verification and SMS without exposing your real number.
            </p>
          </div>

          {/* Mock phone OTP demo */}
          <div className="px-6 py-6 bg-[#0a0e17]/50">
            <div className="max-w-xs mx-auto">
              <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[#64748b] font-mono tabular-nums">+1 (555) 012-3456</span>
                  <span className="text-xs text-[#64748b]">2m ago</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-[#1f2937] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#94a3b8] font-medium">Uber</span>
                </div>
                <p className="text-sm text-[#e2e8f0] pl-7">
                  Your Uber code is{' '}
                  <span className="font-mono font-bold text-[#22c55e] bg-[#22c55e]/10 px-1.5 py-0.5 rounded">
                    4829
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Feature list */}
          <div className="px-6 py-5 border-t border-[#1f2937]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="text-sm text-[#94a3b8]">Receive OTPs and SMS</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="text-sm text-[#94a3b8]">Auto-extract verification codes</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="text-sm text-[#94a3b8]">Release anytime</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-6 py-5 border-t border-[#1f2937] bg-[#111827]">
            <Link
              href="/dashboard/upgrade"
              className="block w-full text-center bg-[#6366f1] hover:bg-[#5558e6] text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */
export default function PhonePage() {
  const router = useRouter();
  const { planTier } = useAuth();
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, SMSMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);

  /* ---------- data fetching ---------- */
  const fetchPhones = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v2/phones');
      if (!res.ok) {
        if (res.status === 401) { router.push('/'); return; }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setPhones(data.phones || []);
    } catch {
      setError('Failed to load phone numbers');
    }
  }, [router]);

  const fetchMessages = useCallback(async (phoneId: string) => {
    setLoadingMessages(phoneId);
    try {
      const res = await apiFetch(`/api/v2/phones/${phoneId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs = (data.messages || []).map((m: SMSMessage) => ({
          ...m,
          extracted_code: m.extracted_code || extractOTPCode(m.body),
        }));
        setMessagesMap((prev) => ({ ...prev, [phoneId]: msgs }));
      }
    } catch {
      // silent
    } finally {
      setLoadingMessages(null);
    }
  }, []);

  useEffect(() => {
    if (planTier !== 'pro') { setLoading(false); return; }
    fetchPhones().finally(() => setLoading(false));
  }, [planTier, fetchPhones]);

  /* ---------- actions ---------- */
  const toggleExpand = (phoneId: string) => {
    if (expandedPhone === phoneId) {
      setExpandedPhone(null);
    } else {
      setExpandedPhone(phoneId);
      if (!messagesMap[phoneId]) {
        fetchMessages(phoneId);
      }
    }
  };

  const handleBuyNumber = async () => {
    setBuying(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/phones', {
        method: 'POST',
        body: JSON.stringify({ country_code: 'US' }),
      });
      if (res.ok) {
        setShowBuyModal(false);
        await fetchPhones();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to provision number');
      }
    } catch {
      setError('Network error');
    } finally {
      setBuying(false);
    }
  };

  const handleRelease = async (phoneId: string) => {
    if (!confirm('Release this number? You will stop receiving messages.')) return;
    setReleasing(phoneId);
    setError(null);
    try {
      const res = await apiFetch(`/api/v2/phones/${phoneId}`, { method: 'DELETE' });
      if (res.ok) {
        setPhones((prev) => prev.filter((p) => p.id !== phoneId));
        if (expandedPhone === phoneId) setExpandedPhone(null);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to release number');
      }
    } catch {
      setError('Network error');
    } finally {
      setReleasing(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  /* ---------- free gate ---------- */
  if (planTier !== 'pro') {
    return <FreeUpgradePrompt />;
  }

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17]">
        <div className="border-b border-[#1f2937]">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="h-7 w-48 bg-[#1f2937] rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-[#111827] border border-[#1f2937] rounded-lg animate-pulse" />
            <div className="h-24 bg-[#111827] border border-[#1f2937] rounded-lg animate-pulse" />
          </div>
          <div className="h-28 bg-[#111827] border border-[#1f2937] rounded-lg animate-pulse" />
          <div className="h-28 bg-[#111827] border border-[#1f2937] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  /* ---------- derived ---------- */
  const activePhones = phones.filter((p) => p.status === 'active');
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const messagesToday = Object.values(messagesMap)
    .flat()
    .filter((m) => new Date(m.received_at) >= todayStart).length;

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <div className="border-b border-[#1f2937]">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#e2e8f0]">Phone Numbers</h1>
              <p className="text-sm text-[#64748b] mt-1">Receive-only burner numbers</p>
            </div>
            {activePhones.length < 2 && (
              <button
                onClick={() => setShowBuyModal(true)}
                className="bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Buy Number
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="bg-[#111827] border border-red-800/40 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-[#ef4444]">{error}</p>
            <button onClick={() => setError(null)} className="text-[#ef4444] hover:text-red-300 ml-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg px-5 py-4 card-glow">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              <span className="text-sm text-[#94a3b8]">Active Numbers</span>
            </div>
            <p className="text-3xl font-bold text-[#22c55e] mt-2 font-mono tabular-nums">
              {activePhones.length}
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg px-5 py-4 card-glow">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
              <span className="text-sm text-[#94a3b8]">Messages Today</span>
            </div>
            <p className="text-3xl font-bold text-[#6366f1] mt-2 font-mono tabular-nums">
              {messagesToday}
            </p>
          </div>
        </div>

        {/* Empty state */}
        {phones.length === 0 && (
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-12 text-center card-glow">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-[#0a0e17] border border-[#1f2937] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-2">No Burner Numbers Yet</h2>
            <p className="text-sm text-[#94a3b8] mb-6 max-w-sm mx-auto">
              Buy a receive-only number to start getting OTPs and SMS without exposing your real number.
            </p>
            <button
              onClick={() => setShowBuyModal(true)}
              className="bg-[#6366f1] hover:bg-[#5558e6] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Buy Phone Number
            </button>
          </div>
        )}

        {/* Phone number cards */}
        {phones.map((phone) => {
          const isExpanded = expandedPhone === phone.id;
          const msgs = messagesMap[phone.id] || [];
          const isLoadingMsgs = loadingMessages === phone.id;
          const isActive = phone.status === 'active';

          return (
            <div
              key={phone.id}
              className="bg-[#111827] border border-[#1f2937] rounded-lg overflow-hidden card-glow"
            >
              {/* Card header */}
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-[#22c55e]/10' : 'bg-[#ef4444]/10'
                  }`}>
                    <svg className={`w-5 h-5 ${isActive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-[#e2e8f0] font-mono tabular-nums">
                      {phone.phone_number}
                    </p>
                    <p className="text-xs text-[#64748b] font-mono tabular-nums">
                      Since {new Date(phone.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isActive ? (
                    <span className="inline-flex items-center rounded-full bg-[#22c55e]/10 px-2.5 py-1 text-xs font-semibold text-[#22c55e]">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[#ef4444]/10 px-2.5 py-1 text-xs font-semibold text-[#ef4444]">
                      Released
                    </span>
                  )}
                  {isActive && (
                    <button
                      onClick={() => handleRelease(phone.id)}
                      disabled={releasing === phone.id}
                      className="text-xs font-medium text-[#ef4444]/70 hover:text-[#ef4444] disabled:opacity-50 transition-colors"
                    >
                      {releasing === phone.id ? 'Releasing...' : 'Release'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expand toggle */}
              {isActive && (
                <button
                  onClick={() => toggleExpand(phone.id)}
                  className="w-full px-5 py-2.5 border-t border-[#1f2937] flex items-center justify-between text-sm text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#0a0e17]/40 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    SMS Feed
                    {msgs.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-[#6366f1]/10 px-2 py-0.5 text-xs font-mono tabular-nums text-[#6366f1]">
                        {msgs.length}
                      </span>
                    )}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* SMS feed (expanded) */}
              {isExpanded && (
                <div className="border-t border-[#1f2937]">
                  {isLoadingMsgs ? (
                    <div className="px-5 py-8 flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 text-[#6366f1]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : msgs.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm text-[#64748b]">
                        No messages yet. Give this number to a service to start receiving SMS.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1f2937]">
                      {msgs.map((msg) => (
                        <div key={msg.id} className="px-5 py-3.5 hover:bg-[#0a0e17]/30 transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-[#e2e8f0]">{msg.from}</span>
                            <span className="text-xs text-[#64748b] font-mono tabular-nums">
                              {formatRelativeTime(msg.received_at)}
                            </span>
                          </div>
                          <p className="text-sm text-[#94a3b8] leading-relaxed">{msg.body}</p>
                          {msg.extracted_code && (
                            <button
                              onClick={() => copyCode(msg.extracted_code!)}
                              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 hover:border-[#22c55e]/40 transition-colors"
                            >
                              <span className="font-mono text-base font-bold text-[#22c55e] tabular-nums">
                                {msg.extracted_code}
                              </span>
                              <span className="text-xs text-[#22c55e]/70">
                                {copiedCode === msg.extracted_code ? 'Copied!' : 'Copy code'}
                              </span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Refresh */}
                  {!isLoadingMsgs && (
                    <div className="px-5 py-2.5 border-t border-[#1f2937]">
                      <button
                        onClick={() => fetchMessages(phone.id)}
                        className="text-xs text-[#6366f1] hover:text-[#818cf8] font-medium transition-colors"
                      >
                        Refresh messages
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer note */}
        <p className="text-xs text-[#64748b] text-center pt-2">
          Phone numbers are receive-only. No outbound SMS or calls.
        </p>
      </div>

      {/* Buy Number Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!buying) setShowBuyModal(false); }}
          />
          <div className="relative bg-[#111827] border border-[#1f2937] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-1">Buy Phone Number</h2>
            <p className="text-sm text-[#64748b] mb-6">
              Provision a new US receive-only number. You can have up to 2 active numbers.
            </p>

            <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg px-4 py-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94a3b8]">Country</span>
                <span className="text-sm font-medium text-[#e2e8f0]">United States (+1)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBuyModal(false)}
                disabled={buying}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyNumber}
                disabled={buying}
                className="bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                {buying && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {buying ? 'Provisioning...' : 'Buy Number'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
