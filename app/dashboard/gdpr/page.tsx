'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface DeletionRequest {
  id: string;
  identity_id: string;
  company_name: string;
  company_email: string;
  request_type: string;
  status: 'sent' | 'awaiting' | 'completed' | 'ignored' | 'escalated';
  sent_at: string;
  response_deadline: string;
  completed_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; textColor: string; bgColor: string }> = {
  sent: { label: 'Sent', textColor: 'text-[#93C5FD]', bgColor: 'bg-[#1E3A8A]' },
  awaiting: { label: 'Awaiting', textColor: 'text-[#FCD34D]', bgColor: 'bg-[#78350F]' },
  completed: { label: 'Completed', textColor: 'text-[#6EE7B7]', bgColor: 'bg-[#065F46]' },
  ignored: { label: 'Ignored', textColor: 'text-[#FCA5A5]', bgColor: 'bg-[#7F1D1D]' },
  escalated: { label: 'Escalated', textColor: 'text-[#F9A8D4]', bgColor: 'bg-[#831843]' },
};

const ESCALATION_LINKS = [
  { label: 'FTC (US)', url: 'https://reportfraud.ftc.gov/' },
  { label: 'ICO (UK)', url: 'https://ico.org.uk/make-a-complaint/' },
  { label: 'CNIL (EU/France)', url: 'https://www.cnil.fr/en/plaintes' },
];

function getDaysRemaining(responseDeadline: string): number {
  const now = new Date();
  const deadline = new Date(responseDeadline);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdue(request: DeletionRequest): boolean {
  if (request.status === 'completed' || request.status === 'escalated') return false;
  return getDaysRemaining(request.response_deadline) < 0;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.sent;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  );
}

export default function GDPRPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newRequestType, setNewRequestType] = useState<'gdpr_erasure' | 'ccpa_deletion'>('gdpr_erasure');
  const [newIdentityId, setNewIdentityId] = useState('');
  const [creating, setCreating] = useState(false);

  // Escalation dropdown
  const [showEscalate, setShowEscalate] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/deletion-requests');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch requests');
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      setError('Failed to load deletion requests');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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
              ? { ...r, status: 'completed' as const, completed_at: new Date().toISOString() }
              : r
          )
        );
      }
    } catch {
      setError('Failed to update request');
    }
  };

  const handleCreate = async () => {
    if (!newCompanyName.trim() || !newCompanyEmail.trim() || !newIdentityId.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/deletion-requests', {
        method: 'POST',
        body: JSON.stringify({
          company_name: newCompanyName.trim(),
          company_email: newCompanyEmail.trim(),
          request_type: newRequestType,
          identity_id: newIdentityId.trim(),
        }),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setNewCompanyName('');
        setNewCompanyEmail('');
        setNewIdentityId('');
        setNewRequestType('gdpr_erasure');
        fetchRequests();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create request');
      }
    } catch {
      setError('Failed to create request');
    } finally {
      setCreating(false);
    }
  };

  // Loading state
  if (loading && requests.length === 0) {
    return (
      <div className="min-h-screen bg-phantom-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-phantom-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-phantom-text-muted text-sm">Loading requests...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && requests.length === 0 && !showCreateForm) {
    return (
      <div className="min-h-screen bg-phantom-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">&#128203;</div>
          <h2 className="text-2xl font-bold text-phantom-text-primary mb-3">
            Deletion Requests
          </h2>
          <p className="text-phantom-text-secondary leading-relaxed mb-8">
            No deletion requests yet. Exercise your GDPR or CCPA rights by sending data
            erasure requests to companies that have your data.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-phantom-accent hover:bg-phantom-accent-hover text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Create Your First Request
          </button>
        </div>
      </div>
    );
  }

  const overdueCount = requests.filter(isOverdue).length;

  return (
    <div className="min-h-screen bg-phantom-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-phantom-bg/80 backdrop-blur-sm border-b border-phantom-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-phantom-text-primary">GDPR Requests</h1>
            <p className="text-sm text-phantom-text-muted">
              {requests.length} request{requests.length !== 1 ? 's' : ''}
              {overdueCount > 0 && (
                <span className="text-red-400 ml-2">
                  ({overdueCount} overdue)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-phantom-accent hover:bg-phantom-accent-hover text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="bg-phantom-danger-surface border border-red-800/40 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* Inline Create Form */}
        {showCreateForm && (
          <div className="bg-phantom-card rounded-xl p-5 border border-phantom-accent/30">
            <h3 className="text-lg font-bold text-phantom-text-primary mb-4">
              New Deletion Request
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="gdpr-company" className="block text-sm font-semibold text-phantom-text-secondary mb-1">
                  Company Name
                </label>
                <input
                  id="gdpr-company"
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g., Acme Corp"
                  className="w-full rounded-lg bg-[#312E81] border border-phantom-border px-4 py-2.5 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors text-sm"
                />
              </div>

              <div>
                <label htmlFor="gdpr-email" className="block text-sm font-semibold text-phantom-text-secondary mb-1">
                  Company Privacy Email
                </label>
                <input
                  id="gdpr-email"
                  type="email"
                  value={newCompanyEmail}
                  onChange={(e) => setNewCompanyEmail(e.target.value)}
                  placeholder="e.g., privacy@acme.com"
                  className="w-full rounded-lg bg-[#312E81] border border-phantom-border px-4 py-2.5 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors text-sm"
                />
              </div>

              <div>
                <label htmlFor="gdpr-identity" className="block text-sm font-semibold text-phantom-text-secondary mb-1">
                  Identity ID
                </label>
                <input
                  id="gdpr-identity"
                  type="text"
                  value={newIdentityId}
                  onChange={(e) => setNewIdentityId(e.target.value)}
                  placeholder="Identity used with this company"
                  className="w-full rounded-lg bg-[#312E81] border border-phantom-border px-4 py-2.5 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors text-sm"
                />
              </div>

              <div>
                <label htmlFor="gdpr-type" className="block text-sm font-semibold text-phantom-text-secondary mb-1">
                  Request Type
                </label>
                <select
                  id="gdpr-type"
                  value={newRequestType}
                  onChange={(e) => setNewRequestType(e.target.value as 'gdpr_erasure' | 'ccpa_deletion')}
                  className="w-full rounded-lg bg-[#312E81] border border-phantom-border px-4 py-2.5 text-phantom-text-primary focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors text-sm"
                >
                  <option value="gdpr_erasure">GDPR Erasure (EU)</option>
                  <option value="ccpa_deletion">CCPA Deletion (California)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewCompanyName('');
                    setNewCompanyEmail('');
                    setNewIdentityId('');
                  }}
                  className="text-phantom-text-muted hover:text-phantom-text-secondary transition-colors text-sm px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newCompanyName.trim() || !newCompanyEmail.trim() || !newIdentityId.trim()}
                  className="bg-phantom-accent hover:bg-phantom-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  {creating && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  Send Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Request cards */}
        {requests.map((req) => {
          const daysRemaining = getDaysRemaining(req.response_deadline);
          const overdue = isOverdue(req);
          const sentDate = new Date(req.sent_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={req.id}
              className={`bg-phantom-card rounded-xl p-4 border-l-4 ${
                overdue ? 'border-l-red-500' : 'border-l-indigo-500'
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-base font-semibold text-phantom-text-primary flex-1 min-w-0 truncate">
                  {req.company_name}
                </h3>
                <StatusBadge status={req.status} />
              </div>

              {/* Details */}
              <div className="space-y-0.5 mb-2">
                <p className="text-sm text-phantom-text-secondary truncate">
                  To: {req.company_email}
                </p>
                <p className="text-sm text-phantom-text-secondary">
                  Sent: {sentDate}
                </p>
                <p className="text-sm text-phantom-text-secondary">
                  Type: {req.request_type === 'ccpa_deletion' ? 'CCPA' : 'GDPR'}
                </p>
              </div>

              {/* Countdown */}
              {(req.status === 'sent' || req.status === 'awaiting') && (
                <p className={`text-sm font-semibold mt-2 ${overdue ? 'text-red-400' : 'text-amber-300'}`}>
                  {overdue
                    ? `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} overdue`
                    : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-phantom-border">
                {req.status !== 'completed' && req.status !== 'escalated' && (
                  <button
                    onClick={() => handleMarkComplete(req.id)}
                    className="bg-phantom-success-bg hover:bg-emerald-800 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Mark Complete
                  </button>
                )}

                {(req.status === 'ignored' || overdue) && (
                  <div className="relative">
                    <button
                      onClick={() => setShowEscalate(showEscalate === req.id ? null : req.id)}
                      className="bg-phantom-danger-bg hover:bg-red-800 text-red-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Escalate
                    </button>

                    {showEscalate === req.id && (
                      <div className="absolute left-0 top-full mt-1 z-20 bg-phantom-card border border-phantom-border rounded-lg shadow-xl py-1 min-w-[180px]">
                        <p className="px-3 py-1.5 text-xs text-phantom-text-muted font-semibold uppercase tracking-wider">
                          File a complaint with:
                        </p>
                        {ESCALATION_LINKS.map((link) => (
                          <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-2 text-sm text-phantom-text-primary hover:bg-phantom-card-hover transition-colors"
                            onClick={() => setShowEscalate(null)}
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {req.status === 'completed' && (
                  <p className="text-xs text-emerald-400">
                    Completed {req.completed_at
                      ? new Date(req.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : ''}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB for quick create */}
      {!showCreateForm && (
        <button
          onClick={() => {
            setShowCreateForm(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-phantom-accent hover:bg-phantom-accent-hover rounded-full shadow-lg shadow-indigo-500/25 flex items-center justify-center text-white text-2xl font-semibold transition-colors z-20"
          aria-label="New deletion request"
        >
          +
        </button>
      )}
    </div>
  );
}
