'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface Honeypot {
  id: string;
  alias_email: string;
  label: string;
  target_service: string;
  status: 'clean' | 'triggered';
  created_at: string;
  triggered_at?: string | null;
  trigger_source?: string | null;
}

export default function HoneypotsPage() {
  const router = useRouter();
  const [honeypots, setHoneypots] = useState<Honeypot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newService, setNewService] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHoneypots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/honeypots');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch honeypots');
      }
      const data = await res.json();
      setHoneypots(data.honeypots || []);
    } catch {
      setError('Failed to load honeypots');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHoneypots();
  }, [fetchHoneypots]);

  const handleCreate = async () => {
    if (!newLabel.trim() || !newService.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch('/api/v2/honeypots', {
        method: 'POST',
        body: JSON.stringify({ label: newLabel.trim(), target_service: newService.trim() }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewLabel('');
        setNewService('');
        fetchHoneypots();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create honeypot');
      }
    } catch {
      setError('Failed to create honeypot');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/v2/honeypots/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status === 401) {
        router.push('/');
        return;
      }
      setDeleteTarget(null);
      fetchHoneypots();
    } catch {
      setError('Failed to delete honeypot');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const activeCount = honeypots.filter((h) => h.status === 'clean').length;
  const triggeredCount = honeypots.filter((h) => h.status === 'triggered').length;

  // -- Skeleton rows for loading state --
  const SkeletonRows = () => (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} className={i % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0d1321]'}>
          <td className="px-4 py-3">
            <div className="h-4 w-48 bg-[#1f2937] rounded animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 bg-[#1f2937] rounded animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-20 bg-[#1f2937] rounded animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-5 w-16 bg-[#1f2937] rounded-full animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-20 bg-[#1f2937] rounded animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-28 bg-[#1f2937] rounded animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-12 bg-[#1f2937] rounded animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  );

  // -- Empty state --
  if (!loading && honeypots.length === 0 && !showCreate) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#111827] border border-[#1f2937] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#e2e8f0] mb-3">
            No Honeypots Deployed
          </h2>
          <p className="text-[#94a3b8] leading-relaxed mb-8">
            Deploy honeypot aliases to detect who sells your data
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-[#6366f1] hover:bg-[#5558e6] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Deploy First Honeypot
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <div className="border-b border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#e2e8f0]">Honeypot Command Center</h1>
              <p className="text-sm text-[#64748b] mt-1">Monitor planted aliases and detect data sellers</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Deploy Honeypot
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-4">
          {/* Active */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg px-5 py-4 card-glow">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              <span className="text-sm text-[#94a3b8]">Honeypots Active</span>
            </div>
            <p className="text-3xl font-bold text-[#22c55e] mt-2 font-mono tabular-nums">
              {loading ? '-' : activeCount}
            </p>
          </div>

          {/* Triggered */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg px-5 py-4 card-glow">
            <div className="flex items-center gap-3">
              {triggeredCount > 0 ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ef4444]" />
                </span>
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] opacity-40" />
              )}
              <span className="text-sm text-[#94a3b8]">Triggered</span>
            </div>
            <p className="text-3xl font-bold text-[#ef4444] mt-2 font-mono tabular-nums">
              {loading ? '-' : triggeredCount}
            </p>
          </div>
        </div>

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

        {/* Honeypot Table */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg overflow-hidden card-glow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-[#1f2937] text-[#64748b] text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Alias Email</th>
                  <th className="px-4 py-3 font-semibold">Label</th>
                  <th className="px-4 py-3 font-semibold">Planted At</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Trigger Date</th>
                  <th className="px-4 py-3 font-semibold">Trigger Source</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : (
                  honeypots.map((hp, idx) => (
                    <tr
                      key={hp.id}
                      className={`table-row-hover border-b border-[#1f2937] last:border-b-0 ${
                        idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0d1321]'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-[#e2e8f0] text-xs whitespace-nowrap">
                        {hp.alias_email}
                      </td>
                      <td className="px-4 py-3 text-[#e2e8f0] font-medium">
                        {hp.label}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] font-mono tabular-nums whitespace-nowrap">
                        {formatDate(hp.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {hp.status === 'triggered' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ef4444]/10 px-2.5 py-0.5 text-xs font-semibold text-[#ef4444]">
                            <span className="animate-pulse-dot relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ef4444]" />
                            </span>
                            TRIGGERED
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#22c55e]/10 px-2.5 py-0.5 text-xs font-semibold text-[#22c55e]">
                            CLEAN
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] font-mono tabular-nums whitespace-nowrap">
                        {hp.triggered_at ? formatDate(hp.triggered_at) : (
                          <span className="text-[#64748b]">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8]">
                        {hp.trigger_source || (
                          <span className="text-[#64748b]">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteTarget(hp.id)}
                          className="text-[#ef4444]/70 hover:text-[#ef4444] transition-colors text-xs font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Empty table state */}
          {!loading && honeypots.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-[#64748b]">No honeypots deployed yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowCreate(false);
              setNewLabel('');
              setNewService('');
            }}
          />
          <div className="relative bg-[#111827] border border-[#1f2937] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-1">Deploy Honeypot</h2>
            <p className="text-sm text-[#64748b] mb-6">
              Create a trap alias to plant at an untrusted service
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="hp-label" className="block text-sm font-semibold text-[#94a3b8] mb-1.5">
                  Label
                </label>
                <input
                  id="hp-label"
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Sketchy Newsletter Trap"
                  className="w-full rounded-lg bg-[#0a0e17] border border-[#1f2937] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label htmlFor="hp-service" className="block text-sm font-semibold text-[#94a3b8] mb-1.5">
                  Target Service
                </label>
                <input
                  id="hp-service"
                  type="text"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="e.g., sketchynewsletter.com"
                  className="w-full rounded-lg bg-[#0a0e17] border border-[#1f2937] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewLabel('');
                  setNewService('');
                }}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newLabel.trim() || !newService.trim()}
                className="bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                {creating && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative bg-[#111827] border border-[#1f2937] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-[#e2e8f0] mb-2">
              Delete Honeypot?
            </h3>
            <p className="text-sm text-[#94a3b8] mb-6">
              This will permanently remove this honeypot alias and all trigger history. Any future emails sent to it will be lost.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                {deleting && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
