'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeletionRequest {
  id: string;
  alias_id: string;
  alias_email?: string;
  company_domain: string;
  status: 'sent' | 'pending' | 'overdue' | 'completed';
  created_at: string;
  responded_at?: string | null;
  response_summary?: string | null;
}

interface Alias {
  id: string;
  alias_email: string;
  service_label: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEADLINE_DAYS = 30;

const STATUS_CONFIG: Record<
  string,
  { label: string; textColor: string; bgColor: string; pulse?: boolean }
> = {
  sent: {
    label: 'SENT',
    textColor: 'text-[#93c5fd]',
    bgColor: 'bg-[#1e3a8a]/60',
  },
  pending: {
    label: 'PENDING',
    textColor: 'text-[#fcd34d]',
    bgColor: 'bg-[#78350f]/60',
  },
  overdue: {
    label: 'OVERDUE',
    textColor: 'text-[#fca5a5]',
    bgColor: 'bg-[#7f1d1d]/60',
    pulse: true,
  },
  completed: {
    label: 'COMPLETED',
    textColor: 'text-[#6ee7b7]',
    bgColor: 'bg-[#065f46]/60',
  },
};

const ESCALATION_AUTHORITIES = [
  {
    name: 'FTC (United States)',
    url: 'https://www.ftc.gov/complaint',
    description: 'Federal Trade Commission',
  },
  {
    name: 'ICO (United Kingdom)',
    url: 'https://ico.org.uk/make-a-complaint/',
    description: 'Information Commissioner\'s Office',
  },
  {
    name: 'CNIL (France / EU)',
    url: 'https://www.cnil.fr/en/plaintes',
    description: 'Commission nationale de l\'informatique',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysElapsed(createdAt: string): number {
  const now = new Date();
  const created = new Date(createdAt);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysRemaining(createdAt: string): number {
  return DEADLINE_DAYS - getDaysElapsed(createdAt);
}

function resolveDisplayStatus(
  req: DeletionRequest
): 'sent' | 'pending' | 'overdue' | 'completed' {
  if (req.status === 'completed') return 'completed';
  const remaining = getDaysRemaining(req.created_at);
  if (remaining < 0) return 'overdue';
  if (req.status === 'pending' || req.status === 'sent') {
    return remaining <= 10 ? 'pending' : 'sent';
  }
  return req.status;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.sent;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.bgColor} ${config.textColor} ${config.pulse ? 'animate-pulse' : ''}`}
    >
      {config.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorMap = {
    blue: {
      text: 'text-[#6366f1]',
      border: 'border-[#6366f1]/30',
      glow: 'shadow-[#6366f1]/5',
    },
    green: {
      text: 'text-[#22c55e]',
      border: 'border-[#22c55e]/30',
      glow: 'shadow-[#22c55e]/5',
    },
    amber: {
      text: 'text-[#f59e0b]',
      border: 'border-[#f59e0b]/30',
      glow: 'shadow-[#f59e0b]/5',
    },
    red: {
      text: 'text-[#ef4444]',
      border: 'border-[#ef4444]/30',
      glow: 'shadow-[#ef4444]/5',
    },
  };
  const c = colorMap[color];
  return (
    <div
      className={`bg-[#111827] border ${c.border} rounded-lg p-4 shadow-lg ${c.glow} card-glow`}
    >
      <p className="text-[#64748b] text-xs font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`font-mono tabular-nums text-2xl font-bold ${c.text}`}>
        {value}
      </p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#1f2937]">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[#1f2937] rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GDPRPage() {
  const router = useRouter();

  // Data
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-request modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedAliasId, setSelectedAliasId] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [creating, setCreating] = useState(false);

  // Escalation modal
  const [escalateRequestId, setEscalateRequestId] = useState<string | null>(null);

  // ---------- Fetch data ----------

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v2/deletion-requests');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      setError('Failed to load deletion requests.');
    }
  }, [router]);

  const fetchAliases = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v2/aliases');
      if (!res.ok) return;
      const data = await res.json();
      setAliases(data.aliases || []);
    } catch {
      // non-critical — aliases are only needed for the create modal
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchRequests(), fetchAliases()]);
      setLoading(false);
    };
    load();
  }, [fetchRequests, fetchAliases]);

  // ---------- Stats ----------

  const stats = useMemo(() => {
    let totalSent = 0;
    let completed = 0;
    let pending = 0;
    let overdue = 0;

    for (const req of requests) {
      totalSent++;
      const display = resolveDisplayStatus(req);
      if (display === 'completed') completed++;
      else if (display === 'overdue') overdue++;
      else pending++;
    }

    return { totalSent, completed, pending, overdue };
  }, [requests]);

  // ---------- Actions ----------

  const handleCreate = async () => {
    if (!selectedAliasId || !companyDomain.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/deletion-requests', {
        method: 'POST',
        body: JSON.stringify({
          alias_id: selectedAliasId,
          company_domain: companyDomain.trim(),
        }),
      });
      if (res.ok) {
        setShowNewModal(false);
        setSelectedAliasId('');
        setCompanyDomain('');
        await fetchRequests();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create request.');
      }
    } catch {
      setError('Failed to create request.');
    } finally {
      setCreating(false);
    }
  };

  const handleMarkComplete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v2/deletion-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: 'completed' as const, responded_at: new Date().toISOString() }
              : r
          )
        );
      }
    } catch {
      setError('Failed to update request.');
    }
  };

  // ---------- Render ----------

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-b border-[#1f2937]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#e2e8f0] tracking-tight">
              GDPR Command Center
            </h1>
            <p className="text-sm text-[#64748b] mt-1">
              Track and enforce your data deletion rights
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="bg-[#6366f1] hover:bg-[#5558e6] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Send New Request
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Error banner                                                      */}
        {/* ---------------------------------------------------------------- */}
        {error && (
          <div className="bg-[#7f1d1d]/30 border border-[#ef4444]/30 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-[#fca5a5]">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-[#fca5a5] hover:text-[#ef4444] ml-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Stats bar                                                         */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Sent" value={stats.totalSent} color="blue" />
          <StatCard label="Completed" value={stats.completed} color="green" />
          <StatCard label="Pending" value={stats.pending} color="amber" />
          <StatCard label="Overdue >30d" value={stats.overdue} color="red" />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Table or empty / loading state                                    */}
        {/* ---------------------------------------------------------------- */}
        {loading ? (
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#1f2937] bg-[#0d1117]">
                  {['Company', 'Alias', 'Request Date', 'Status', 'Days Remaining', 'Response', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#64748b]"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : requests.length === 0 ? (
          /* Empty state */
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg card-glow flex flex-col items-center justify-center py-20 px-6">
            <div className="w-16 h-16 rounded-full bg-[#1f2937] flex items-center justify-center mb-5">
              <svg
                className="w-8 h-8 text-[#64748b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-2">
              No deletion requests sent yet
            </h2>
            <p className="text-sm text-[#94a3b8] mb-6 max-w-md text-center">
              Exercise your GDPR and CCPA rights by sending data erasure requests to companies that hold your personal data.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="bg-[#6366f1] hover:bg-[#5558e6] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              Send Your First Request
            </button>
          </div>
        ) : (
          /* Requests table */
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#1f2937] bg-[#0d1117]">
                  {['Company', 'Alias', 'Request Date', 'Status', 'Days Remaining', 'Response', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#64748b] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {requests.map((req, idx) => {
                  const displayStatus = resolveDisplayStatus(req);
                  const remaining = getDaysRemaining(req.created_at);
                  const isOverdue = displayStatus === 'overdue';
                  const isComplete = displayStatus === 'completed';
                  const stripe = idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0d1117]';

                  return (
                    <tr
                      key={req.id}
                      className={`${stripe} border-b border-[#1f2937] hover:bg-[#1a2236] transition-colors`}
                    >
                      {/* Company */}
                      <td className="px-4 py-3">
                        <span className="text-[#e2e8f0] font-medium">
                          {req.company_domain}
                        </span>
                      </td>

                      {/* Alias */}
                      <td className="px-4 py-3">
                        <span className="text-[#94a3b8] font-mono text-xs">
                          {req.alias_email || '---'}
                        </span>
                      </td>

                      {/* Request Date */}
                      <td className="px-4 py-3">
                        <span className="text-[#94a3b8] font-mono tabular-nums text-xs">
                          {formatDate(req.created_at)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={displayStatus} />
                      </td>

                      {/* Days Remaining */}
                      <td className="px-4 py-3">
                        {isComplete ? (
                          <span className="text-[#64748b] text-xs">--</span>
                        ) : (
                          <span
                            className={`font-mono tabular-nums text-sm font-semibold ${
                              isOverdue
                                ? 'text-[#ef4444]'
                                : remaining <= 7
                                  ? 'text-[#f59e0b]'
                                  : 'text-[#e2e8f0]'
                            }`}
                          >
                            {isOverdue
                              ? `${Math.abs(remaining)}d overdue`
                              : `${remaining}d left`}
                          </span>
                        )}
                      </td>

                      {/* Response */}
                      <td className="px-4 py-3 max-w-[200px]">
                        {req.response_summary ? (
                          <span className="text-[#94a3b8] text-xs truncate block">
                            {req.response_summary}
                          </span>
                        ) : (
                          <span className="text-[#64748b] text-xs">No response</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!isComplete && (
                            <button
                              onClick={() => handleMarkComplete(req.id)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[#065f46]/40 text-[#22c55e] hover:bg-[#065f46]/70 transition-colors whitespace-nowrap"
                            >
                              Mark Complete
                            </button>
                          )}
                          {isOverdue && (
                            <button
                              onClick={() => setEscalateRequestId(req.id)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[#7f1d1d]/40 text-[#ef4444] hover:bg-[#7f1d1d]/70 transition-colors whitespace-nowrap"
                            >
                              Escalate
                            </button>
                          )}
                          {isComplete && (
                            <span className="text-xs text-[#22c55e]">
                              {req.responded_at ? formatDate(req.responded_at) : 'Done'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Send New Request Modal                                              */}
      {/* ================================================================== */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!creating) {
                setShowNewModal(false);
                setSelectedAliasId('');
                setCompanyDomain('');
              }
            }}
          />

          {/* Modal content */}
          <div className="relative bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#e2e8f0]">
                Send New Deletion Request
              </h2>
              <button
                onClick={() => {
                  if (!creating) {
                    setShowNewModal(false);
                    setSelectedAliasId('');
                    setCompanyDomain('');
                  }
                }}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Alias select */}
              <div>
                <label
                  htmlFor="modal-alias"
                  className="block text-sm font-semibold text-[#94a3b8] mb-1.5"
                >
                  Select Alias
                </label>
                <select
                  id="modal-alias"
                  value={selectedAliasId}
                  onChange={(e) => setSelectedAliasId(e.target.value)}
                  className="w-full rounded-lg bg-[#0a0e17] border border-[#1f2937] px-4 py-2.5 text-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-colors"
                >
                  <option value="">Choose an alias...</option>
                  {aliases.map((alias) => (
                    <option key={alias.id} value={alias.id}>
                      {alias.alias_email}
                      {alias.service_label ? ` (${alias.service_label})` : ''}
                    </option>
                  ))}
                </select>
                {aliases.length === 0 && !loading && (
                  <p className="text-xs text-[#64748b] mt-1">
                    No aliases found. Create one first.
                  </p>
                )}
              </div>

              {/* Company domain */}
              <div>
                <label
                  htmlFor="modal-domain"
                  className="block text-sm font-semibold text-[#94a3b8] mb-1.5"
                >
                  Company Domain
                </label>
                <input
                  id="modal-domain"
                  type="text"
                  value={companyDomain}
                  onChange={(e) => setCompanyDomain(e.target.value)}
                  placeholder="e.g., facebook.com"
                  className="w-full rounded-lg bg-[#0a0e17] border border-[#1f2937] px-4 py-2.5 text-[#e2e8f0] placeholder-[#64748b]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#1f2937]">
              <button
                onClick={() => {
                  if (!creating) {
                    setShowNewModal(false);
                    setSelectedAliasId('');
                    setCompanyDomain('');
                  }
                }}
                disabled={creating}
                className="text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !selectedAliasId || !companyDomain.trim()}
                className="bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                {creating && (
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Escalation Modal                                                    */}
      {/* ================================================================== */}
      {escalateRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEscalateRequestId(null)}
          />

          {/* Modal content */}
          <div className="relative bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-[#e2e8f0]">
                Escalate Request
              </h2>
              <button
                onClick={() => setEscalateRequestId(null)}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-[#94a3b8] mb-5">
              This company has failed to respond within the legally mandated 30-day window. File a formal complaint with a data protection authority.
            </p>

            <div className="space-y-3">
              {ESCALATION_AUTHORITIES.map((auth) => (
                <a
                  key={auth.name}
                  href={auth.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-[#0a0e17] border border-[#1f2937] rounded-lg px-4 py-3 hover:border-[#6366f1]/50 hover:bg-[#1a2236] transition-colors group"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#e2e8f0] group-hover:text-[#6366f1] transition-colors">
                      {auth.name}
                    </p>
                    <p className="text-xs text-[#64748b]">{auth.description}</p>
                  </div>
                  <svg
                    className="w-4 h-4 text-[#64748b] group-hover:text-[#6366f1] transition-colors flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-[#1f2937] flex justify-end">
              <button
                onClick={() => setEscalateRequestId(null)}
                className="text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
