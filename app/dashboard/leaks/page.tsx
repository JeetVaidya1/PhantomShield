'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

// ---- Types ----

interface LeakDetection {
  id: string;
  alias_id: string;
  alias_email: string;
  unexpected_sender_domain: string;
  detected_at: string;
  dismissed: boolean;
  severity?: string;
  gdpr_sent?: boolean;
}

// ---- Sub-components ----

function StatPill({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: 'red' | 'green' | 'amber';
}) {
  const bgMap = {
    red: value > 0 ? 'bg-[#ef4444]/15 border-[#ef4444]/30' : 'bg-[#111827] border-[#1f2937]',
    green: 'bg-[#22c55e]/15 border-[#22c55e]/30',
    amber: value > 0 ? 'bg-[#f59e0b]/15 border-[#f59e0b]/30' : 'bg-[#111827] border-[#1f2937]',
  };
  const textMap = {
    red: value > 0 ? 'text-[#ef4444]' : 'text-[#64748b]',
    green: 'text-[#22c55e]',
    amber: value > 0 ? 'text-[#f59e0b]' : 'text-[#64748b]',
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${bgMap[variant]}`}>
      <span className={`text-2xl font-mono tabular-nums font-bold ${textMap[variant]}`}>
        {value}
      </span>
      <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'high') {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
        CRITICAL
      </span>
    );
  }
  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
      WARNING
    </span>
  );
}

function StatusBadge({ leak }: { leak: LeakDetection }) {
  if (leak.dismissed) {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#64748b]/15 text-[#64748b] border border-[#64748b]/30">
        DISMISSED
      </span>
    );
  }
  if (leak.gdpr_sent) {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30">
        GDPR SENT
      </span>
    );
  }
  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
      ACTIVE
    </span>
  );
}

function SortableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider cursor-pointer select-none hover:text-[#94a3b8] transition-colors group">
      <span className="inline-flex items-center gap-1">
        {children}
        <svg
          className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
      </span>
    </th>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1f2937] flex gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3 w-20 bg-[#1f2937] rounded animate-pulse" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`px-4 py-4 flex items-center gap-8 ${i % 2 === 1 ? 'bg-[#0d1321]' : ''}`}
        >
          <div className="h-4 w-40 bg-[#1f2937] rounded animate-pulse" />
          <div className="h-4 w-32 bg-[#1f2937] rounded animate-pulse" />
          <div className="h-4 w-24 bg-[#1f2937] rounded animate-pulse" />
          <div className="h-5 w-16 bg-[#1f2937] rounded-full animate-pulse" />
          <div className="h-5 w-14 bg-[#1f2937] rounded-full animate-pulse" />
          <div className="h-4 w-36 bg-[#1f2937] rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-12 text-center">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-40" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22c55e]" />
        </span>
        <span className="text-sm font-medium text-[#22c55e]">All Clear</span>
      </div>
      <p className="text-[#e2e8f0] text-lg font-semibold mb-1">
        No leaks detected
      </p>
      <p className="text-[#94a3b8] text-sm max-w-sm mx-auto">
        Your aliases are clean. We continuously monitor for unexpected sender activity and will alert you if anything suspicious is detected.
      </p>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-[#111827] border border-[#1f2937] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-bold text-[#e2e8f0] mb-2">{title}</h3>
        <p className="text-sm text-[#94a3b8] mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1f2937] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#ef4444] hover:bg-[#dc2626] text-white transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----

export default function LeaksPage() {
  const router = useRouter();
  const [leaks, setLeaks] = useState<LeakDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [killTarget, setKillTarget] = useState<LeakDetection | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchLeaks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/v2/leaks');

      if (res.status === 401) {
        router.push('/');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to load leak data');
      }

      const data: { leaks: LeakDetection[] } = await res.json();
      setLeaks(data.leaks || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchLeaks();
  }, [fetchLeaks]);

  const handleDismiss = useCallback(async (leak: LeakDetection) => {
    setActionInProgress(leak.id);
    try {
      const res = await apiFetch(`/api/v2/leaks/${leak.id}/dismiss`, {
        method: 'PATCH',
      });

      if (res.ok) {
        setLeaks((prev) =>
          prev.map((l) => (l.id === leak.id ? { ...l, dismissed: true } : l))
        );
      } else {
        setError('Failed to dismiss leak');
      }
    } catch {
      setError('Failed to dismiss leak');
    } finally {
      setActionInProgress(null);
    }
  }, []);

  const handleSendGDPR = useCallback(async (leak: LeakDetection) => {
    setActionInProgress(leak.id);
    try {
      const res = await apiFetch('/api/v2/deletion-requests', {
        method: 'POST',
        body: JSON.stringify({
          alias_id: leak.alias_id,
          company_domain: leak.unexpected_sender_domain,
        }),
      });

      if (res.ok) {
        setLeaks((prev) =>
          prev.map((l) => (l.id === leak.id ? { ...l, gdpr_sent: true } : l))
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to send GDPR request');
      }
    } catch {
      setError('Failed to send GDPR request');
    } finally {
      setActionInProgress(null);
    }
  }, []);

  const handleKillAlias = useCallback(async () => {
    if (!killTarget) return;

    const target = killTarget;
    setKillTarget(null);
    setActionInProgress(target.id);

    try {
      const res = await apiFetch(`/api/v2/aliases/${target.alias_id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setLeaks((prev) => prev.filter((l) => l.alias_id !== target.alias_id));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to kill alias');
      }
    } catch {
      setError('Failed to kill alias');
    } finally {
      setActionInProgress(null);
    }
  }, [killTarget]);

  // Computed stats
  const totalLeaks = leaks.length;
  const resolvedLeaks = leaks.filter((l) => l.dismissed).length;
  const pendingLeaks = leaks.filter((l) => !l.dismissed).length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-[#0a0e17]/80 backdrop-blur-md border-b border-[#1f2937]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[#64748b] hover:text-[#e2e8f0] transition-colors"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[#e2e8f0]">Leak Detection</h1>
          <button
            onClick={fetchLeaks}
            disabled={loading}
            className="ml-auto text-[#64748b] hover:text-[#e2e8f0] transition-colors disabled:opacity-50"
            aria-label="Refresh data"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-[#ef4444]">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-[#ef4444]/60 hover:text-[#ef4444] transition-colors shrink-0"
                aria-label="Dismiss error"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4">
            <StatPill label="Total Leaks" value={totalLeaks} variant="red" />
            <StatPill label="Resolved" value={resolvedLeaks} variant="green" />
            <StatPill label="Pending" value={pendingLeaks} variant="amber" />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <SkeletonTable />
        ) : leaks.length === 0 ? (
          <EmptyState />
        ) : (
          /* Data Table */
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden card-glow">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-[#1f2937]">
                    <SortableHeader>Alias</SortableHeader>
                    <SortableHeader>Unexpected Sender</SortableHeader>
                    <SortableHeader>Detected Date</SortableHeader>
                    <SortableHeader>Severity</SortableHeader>
                    <SortableHeader>Status</SortableHeader>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaks.map((leak, idx) => {
                    const isProcessing = actionInProgress === leak.id;
                    const severity = leak.severity || 'medium';

                    return (
                      <tr
                        key={leak.id}
                        className={`table-row-hover border-b border-[#1f2937]/50 last:border-b-0 transition-colors ${
                          idx % 2 === 1 ? 'bg-[#0d1321]' : ''
                        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        {/* Alias */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-[#e2e8f0] truncate block max-w-[200px]">
                            {leak.alias_email}
                          </span>
                        </td>

                        {/* Unexpected Sender */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-[#94a3b8] font-mono">
                            {leak.unexpected_sender_domain}
                          </span>
                        </td>

                        {/* Detected Date */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono tabular-nums text-[#94a3b8]">
                            {formatDate(leak.detected_at)}
                          </span>
                        </td>

                        {/* Severity */}
                        <td className="px-4 py-3">
                          <SeverityBadge severity={severity} />
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge leak={leak} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {!leak.dismissed && (
                              <button
                                onClick={() => handleDismiss(leak)}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-md text-xs font-medium text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1f2937] transition-colors disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            )}
                            {!leak.gdpr_sent && !leak.dismissed && (
                              <button
                                onClick={() => handleSendGDPR(leak)}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#6366f1]/15 text-[#6366f1] hover:bg-[#6366f1]/25 border border-[#6366f1]/30 transition-colors disabled:opacity-50"
                              >
                                Send GDPR
                              </button>
                            )}
                            {!leak.dismissed && (
                              <button
                                onClick={() => setKillTarget(leak)}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 border border-[#ef4444]/30 transition-colors disabled:opacity-50"
                              >
                                Kill Alias
                              </button>
                            )}
                            {leak.dismissed && (
                              <span className="text-xs text-[#64748b]">--</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Kill confirm dialog */}
      {killTarget && (
        <ConfirmDialog
          title="Kill Alias"
          message={`Are you sure you want to permanently deactivate ${killTarget.alias_email}? This will stop all email forwarding for this alias and cannot be undone.`}
          confirmLabel="Kill Alias"
          onConfirm={handleKillAlias}
          onCancel={() => setKillTarget(null)}
        />
      )}
    </div>
  );
}
