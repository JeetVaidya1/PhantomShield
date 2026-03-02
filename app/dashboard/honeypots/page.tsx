'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface HoneypotTrigger {
  triggered_at: string;
  trigger_from_email: string;
  trigger_from_domain: string;
}

interface Honeypot {
  id: string;
  alias_email: string;
  service_label: string;
  trigger_count: number;
  last_trigger: string | null;
  triggers: HoneypotTrigger[];
  created_at: string;
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

  // Detail modal
  const [selectedHoneypot, setSelectedHoneypot] = useState<Honeypot | null>(null);

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
      const sorted = (data.honeypots || []).sort(
        (a: Honeypot, b: Honeypot) => b.trigger_count - a.trigger_count
      );
      setHoneypots(sorted);
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
        body: JSON.stringify({ label: newLabel.trim(), planted_at_service: newService.trim() }),
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
      await apiFetch(`/api/v2/honeypots/${id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setSelectedHoneypot(null);
      fetchHoneypots();
    } catch {
      setError('Failed to delete honeypot');
    } finally {
      setDeleting(false);
    }
  };

  // Extract label and service from service_label ("Label — Service")
  const parseServiceLabel = (serviceLabel: string) => {
    const parts = serviceLabel.split(' — ');
    return {
      label: parts[0] || serviceLabel,
      service: parts[1] || '',
    };
  };

  // Loading state
  if (loading && honeypots.length === 0) {
    return (
      <div className="min-h-screen bg-phantom-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-phantom-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-phantom-text-muted text-sm">Loading honeypots...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && honeypots.length === 0 && !showCreate) {
    return (
      <div className="min-h-screen bg-phantom-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">&#127855;</div>
          <h2 className="text-2xl font-bold text-phantom-text-primary mb-3">
            Honeypot Aliases
          </h2>
          <p className="text-phantom-text-secondary leading-relaxed mb-8">
            Plant fake email aliases at services you don&apos;t trust. If the alias receives
            email, you&apos;ll know your data was shared or sold.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-phantom-accent hover:bg-phantom-accent-hover text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Create Your First Honeypot
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-phantom-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-phantom-bg/80 backdrop-blur-sm border-b border-phantom-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-phantom-text-primary">Honeypots</h1>
            <p className="text-sm text-phantom-text-muted">
              {honeypots.length} alias{honeypots.length !== 1 ? 'es' : ''} planted
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
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

      {/* Honeypot cards */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {honeypots.map((hp) => {
          const { label, service } = parseServiceLabel(hp.service_label);
          return (
            <button
              key={hp.id}
              onClick={() => setSelectedHoneypot(hp)}
              className="w-full text-left bg-phantom-card hover:bg-phantom-card-hover rounded-xl p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-phantom-text-primary truncate">
                    {label}
                  </p>
                  {service && (
                    <p className="text-sm text-phantom-text-muted mt-0.5">
                      Planted at: {service}
                    </p>
                  )}
                </div>
                {hp.trigger_count > 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-phantom-danger-bg text-red-300 whitespace-nowrap">
                    Triggered {hp.trigger_count}x
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-phantom-success-bg text-emerald-300 whitespace-nowrap">
                    Clean
                  </span>
                )}
              </div>
              <p className="text-xs text-phantom-text-muted mt-2 font-mono truncate">
                {hp.alias_email}
              </p>
            </button>
          );
        })}

        {/* Add new button */}
        <button
          onClick={() => setShowCreate(true)}
          className="w-full border-2 border-dashed border-phantom-border hover:border-phantom-accent/50 rounded-xl p-4 text-phantom-text-muted hover:text-phantom-accent transition-colors"
        >
          + New Honeypot
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          />
          <div className="relative bg-phantom-card rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-phantom-text-primary mb-6">
              Create Honeypot
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="hp-label" className="block text-sm font-semibold text-phantom-text-secondary mb-1.5">
                  Label
                </label>
                <input
                  id="hp-label"
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Trap for Dark Forum"
                  className="w-full rounded-lg bg-[#312E81] border border-phantom-border px-4 py-3 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label htmlFor="hp-service" className="block text-sm font-semibold text-phantom-text-secondary mb-1.5">
                  Service where you&apos;ll plant it
                </label>
                <input
                  id="hp-service"
                  type="text"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="e.g., SketchyNewsletter.com"
                  className="w-full rounded-lg bg-[#312E81] border border-phantom-border px-4 py-3 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewLabel('');
                  setNewService('');
                }}
                className="text-phantom-text-muted hover:text-phantom-text-secondary transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newLabel.trim() || !newService.trim()}
                className="bg-phantom-accent hover:bg-phantom-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
              >
                {creating && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedHoneypot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedHoneypot(null)}
          />
          <div className="relative bg-phantom-card rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-bold text-phantom-text-primary pr-4">
                {parseServiceLabel(selectedHoneypot.service_label).label}
              </h2>
              {selectedHoneypot.trigger_count > 0 ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-phantom-danger-bg text-red-300 whitespace-nowrap shrink-0">
                  Triggered {selectedHoneypot.trigger_count}x
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-phantom-success-bg text-emerald-300 whitespace-nowrap shrink-0">
                  Clean
                </span>
              )}
            </div>

            <p className="text-sm text-phantom-text-secondary mb-1">
              Planted at: {parseServiceLabel(selectedHoneypot.service_label).service || 'Unknown'}
            </p>
            <p className="text-xs text-phantom-text-muted font-mono mb-4">
              {selectedHoneypot.alias_email}
            </p>

            {/* Trigger history */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {selectedHoneypot.triggers.length > 0 ? (
                <div className="space-y-0">
                  <p className="text-xs font-semibold text-phantom-text-secondary uppercase tracking-wider mb-3">
                    Trigger History
                  </p>
                  {selectedHoneypot.triggers.map((t, i) => (
                    <div
                      key={i}
                      className="border-t border-phantom-border py-3"
                    >
                      <p className="text-xs text-phantom-text-muted">
                        {new Date(t.triggered_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-sm text-red-300 mt-0.5">
                        {t.trigger_from_email}
                      </p>
                      <p className="text-xs text-phantom-text-secondary">
                        {t.trigger_from_domain}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-phantom-text-muted text-sm">No triggers yet -- this alias is still clean.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-phantom-border">
              <button
                onClick={() => setDeleteTarget(selectedHoneypot.id)}
                className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedHoneypot(null)}
                className="text-phantom-text-muted hover:text-phantom-text-secondary transition-colors px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative bg-phantom-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-phantom-text-primary mb-2">
              Delete Honeypot?
            </h3>
            <p className="text-sm text-phantom-text-secondary mb-6">
              This will permanently remove this honeypot alias. Any future emails to it will be lost.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-phantom-text-muted hover:text-phantom-text-secondary transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
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
