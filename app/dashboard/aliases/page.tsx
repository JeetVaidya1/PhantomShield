'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Alias {
  id: string;
  alias_email: string;
  service_label: string | null;
  forwarding_email: string | null;
  status: string;
  created_at: string;
  emails_received?: number;
  trackers_blocked?: number;
  leak_detected?: boolean;
  last_activity?: string;
}

function parseServiceLabel(serviceLabel: string | null) {
  if (!serviceLabel) return { label: 'Unnamed', service: '' };
  const parts = serviceLabel.split(' — ');
  return { label: parts[0] || serviceLabel, service: parts[1] || '' };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(dateStr: string | undefined) {
  if (!dateStr) return '--';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// --- Status Badge ---
function StatusBadge({ status, leak }: { status: string; leak?: boolean }) {
  if (leak) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#ef4444]/10 text-[#ef4444]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse-dot" />
        LEAK
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#22c55e]/10 text-[#22c55e]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
        ACTIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#64748b]/10 text-[#64748b]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#64748b]" />
      KILLED
    </span>
  );
}

// --- Skeleton ---
function SkeletonTable() {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1f2937]">
              {['Alias', 'Label', 'Service', 'Emails', 'Trackers', 'Status', 'Last Activity', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className={i % 2 === 1 ? 'bg-[#0d1321]' : ''}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-[#1f2937] rounded animate-pulse" style={{ width: j === 0 ? '180px' : j < 3 ? '80px' : '50px' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Detail Panel ---
function AliasDetail({
  alias,
  onClose,
  onCopy,
  onKill,
  copied,
}: {
  alias: Alias;
  onClose: () => void;
  onCopy: () => void;
  onKill: () => void;
  copied: boolean;
}) {
  const { label, service } = parseServiceLabel(alias.service_label);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111827] border border-[#1f2937] rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-[#e2e8f0]">{label}</h2>
            {service && <p className="text-sm text-[#94a3b8] mt-0.5">{service}</p>}
          </div>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#e2e8f0] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Alias email with copy */}
        <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg px-4 py-3 flex items-center gap-3 mb-6">
          <code className="flex-1 text-sm font-mono text-[#6366f1] truncate">{alias.alias_email}</code>
          <button
            onClick={onCopy}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1]/20 transition-colors"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-3">
            <p className="text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">Emails Received</p>
            <p className="text-xl font-bold font-mono tabular-nums text-[#e2e8f0] mt-1">{alias.emails_received ?? 0}</p>
          </div>
          <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-3">
            <p className="text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">Trackers Blocked</p>
            <p className="text-xl font-bold font-mono tabular-nums text-[#6366f1] mt-1">{alias.trackers_blocked ?? 0}</p>
          </div>
          <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-3">
            <p className="text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">Status</p>
            <div className="mt-1"><StatusBadge status={alias.status} leak={alias.leak_detected} /></div>
          </div>
          <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-3">
            <p className="text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">Created</p>
            <p className="text-sm font-mono tabular-nums text-[#e2e8f0] mt-1">{formatDate(alias.created_at)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {alias.status === 'active' && (
            <button
              onClick={onKill}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#ef4444]/30 text-[#ef4444] text-sm font-semibold hover:bg-[#ef4444]/10 transition-colors"
            >
              Kill Alias
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#1f2937] text-[#94a3b8] text-sm font-medium hover:bg-[#1f2937]/50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Create Modal ---
function CreateAliasModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState('');
  const [service, setService] = useState('');
  const [forwarding, setForwarding] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!label.trim() || !forwarding.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/aliases', {
        method: 'POST',
        body: JSON.stringify({
          label: label.trim(),
          service_label: service.trim() || undefined,
          forwarding_email: forwarding.trim(),
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create alias');
      }
    } catch {
      setError('Failed to create alias');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111827] border border-[#1f2937] rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#e2e8f0]">Create Alias</h2>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#e2e8f0] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20">
            <p className="text-xs text-[#ef4444]">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold tracking-wider uppercase text-[#64748b] mb-1.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Netflix, Shopping"
              className="w-full rounded-lg bg-[#0a0e17] border border-[#1f2937] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold tracking-wider uppercase text-[#64748b] mb-1.5">Service (optional)</label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. Amazon, Spotify"
              className="w-full rounded-lg bg-[#0a0e17] border border-[#1f2937] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold tracking-wider uppercase text-[#64748b] mb-1.5">Forward To</label>
            <input
              type="email"
              value={forwarding}
              onChange={(e) => setForwarding(e.target.value)}
              placeholder="your-real-email@example.com"
              className="w-full rounded-lg bg-[#0a0e17] border border-[#1f2937] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1.5">Encrypted before storage — we never see your real email</p>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4 bg-[#0a0e17] border border-[#1f2937] rounded-lg px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-[#64748b] mb-1">Generated Alias</p>
          <p className="text-sm font-mono text-[#6366f1]">
            {label ? `${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.floor(Math.random() * 99)}` : 'your-label'}-xx@phantomdefender.com
          </p>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#1f2937] text-[#94a3b8] text-sm font-medium hover:bg-[#1f2937]/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !label.trim() || !forwarding.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {creating && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            Create Alias
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Confirm Dialog ---
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#111827] border border-[#1f2937] rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-base font-bold text-[#e2e8f0] mb-2">{title}</h3>
        <p className="text-sm text-[#94a3b8] mb-6">{message}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#1f2937] text-[#94a3b8] text-sm font-medium hover:bg-[#1f2937]/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// === MAIN PAGE ===
export default function AliasesPage() {
  const router = useRouter();
  const { planTier } = useAuth();
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAlias, setSelectedAlias] = useState<Alias | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const maxAliases = planTier === 'pro' ? 15 : 3;
  const activeCount = useMemo(() => aliases.filter((a) => a.status === 'active').length, [aliases]);

  const fetchAliases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/aliases');
      if (!res.ok) {
        if (res.status === 401) { router.push('/'); return; }
        throw new Error('Failed to fetch aliases');
      }
      const data = await res.json();
      setAliases(data.aliases || []);
    } catch {
      setError('Failed to load aliases');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await apiFetch(`/api/v2/aliases/${id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setSelectedAlias(null);
      fetchAliases();
    } catch {
      setError('Failed to deactivate alias');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = async (aliasEmail: string, id: string) => {
    try {
      await navigator.clipboard.writeText(aliasEmail);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#e2e8f0]">Email Aliases</h1>
          <p className="text-sm text-[#64748b]">
            <span className="font-mono tabular-nums text-[#e2e8f0]">{activeCount}</span>
            <span className="mx-1">/</span>
            <span className="font-mono tabular-nums">{maxAliases}</span>
            <span className="ml-1">{planTier === 'pro' ? 'Pro' : 'Free'}</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={activeCount >= maxAliases}
          className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Alias
        </button>
      </div>

      {/* Capacity warning */}
      {activeCount >= maxAliases && planTier === 'free' && (
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-[#f59e0b]">
            Alias limit reached. Upgrade for up to 15 aliases.
          </p>
          <button
            onClick={() => router.push('/dashboard/upgrade')}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md bg-[#f59e0b]/20 text-[#f59e0b] hover:bg-[#f59e0b]/30 transition-colors"
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-[#ef4444]">{error}</p>
          <button onClick={() => setError(null)} className="text-[#ef4444] hover:text-[#ef4444]/70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && aliases.length === 0 ? (
        <SkeletonTable />
      ) : aliases.length === 0 ? (
        /* Empty state */
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-8 text-center card-glow">
          <div className="w-12 h-12 rounded-full bg-[#6366f1]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-[#e2e8f0] mb-1">No aliases yet</h2>
          <p className="text-sm text-[#94a3b8] mb-6">Create your first disposable email alias to start protecting your identity.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-lg bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-semibold transition-colors"
          >
            Create First Alias
          </button>
        </div>
      ) : (
        /* Alias Table */
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden card-glow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f2937]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">Alias</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">Label</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b] hidden md:table-cell">Service</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b] hidden lg:table-cell">Emails</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b] hidden lg:table-cell">Trackers</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b] hidden md:table-cell">Last Activity</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((alias, i) => {
                  const { label, service } = parseServiceLabel(alias.service_label);
                  return (
                    <tr
                      key={alias.id}
                      className={`table-row-hover cursor-pointer border-b border-[#1f2937]/50 last:border-0 ${
                        i % 2 === 1 ? 'bg-[#0d1321]' : ''
                      }`}
                      onClick={() => setSelectedAlias(alias)}
                    >
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono text-[#6366f1] truncate block max-w-[200px]">{alias.alias_email}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-[#e2e8f0]">{label}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-[#94a3b8]">{service || '--'}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="font-mono tabular-nums text-sm text-[#e2e8f0]">{alias.emails_received ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="font-mono tabular-nums text-sm text-[#6366f1]">{alias.trackers_blocked ?? 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={alias.status} leak={alias.leak_detected} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="font-mono tabular-nums text-xs text-[#64748b]">{formatRelative(alias.last_activity || alias.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleCopy(alias.alias_email, alias.id)}
                            className="text-xs font-medium px-2 py-1 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1f2937] transition-colors"
                          >
                            {copiedId === alias.id ? 'Copied' : 'Copy'}
                          </button>
                          {alias.status === 'active' && (
                            <button
                              onClick={() => setDeleteTarget(alias.id)}
                              className="text-xs font-medium px-2 py-1 rounded text-[#ef4444]/70 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                            >
                              Kill
                            </button>
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

      {/* Create Modal */}
      {showCreate && (
        <CreateAliasModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchAliases}
        />
      )}

      {/* Detail Panel */}
      {selectedAlias && (
        <AliasDetail
          alias={selectedAlias}
          onClose={() => setSelectedAlias(null)}
          onCopy={() => handleCopy(selectedAlias.alias_email, selectedAlias.id)}
          onKill={() => setDeleteTarget(selectedAlias.id)}
          copied={copiedId === selectedAlias.id}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Kill Alias?"
          message="This alias will stop receiving emails. Any future emails sent to it will be lost. This action cannot be undone."
          confirmLabel="Kill Alias"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
