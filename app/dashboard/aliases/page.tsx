'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface Alias {
  id: string;
  alias_email: string;
  label: string;
  service_label: string | null;
  status: string;
  created_at: string;
}

export default function AliasesPage() {
  const router = useRouter();
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newService, setNewService] = useState('');
  const [creating, setCreating] = useState(false);

  // Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAliases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/aliases');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
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

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v2/aliases', {
        method: 'POST',
        body: JSON.stringify({
          label: newLabel.trim(),
          service_label: newService.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewLabel('');
        setNewService('');
        fetchAliases();
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

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await apiFetch(`/api/v2/aliases/${id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchAliases();
    } catch {
      setError('Failed to delete alias');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = async (aliasEmail: string, id: string) => {
    try {
      await navigator.clipboard.writeText(aliasEmail);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  // Loading state
  if (loading && aliases.length === 0) {
    return (
      <div className="min-h-screen bg-phantom-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-phantom-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-phantom-text-muted text-sm">Loading aliases...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && aliases.length === 0 && !showCreate) {
    return (
      <div className="min-h-screen bg-phantom-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">&#9993;</div>
          <h2 className="text-2xl font-bold text-phantom-text-primary mb-3">
            Email Aliases
          </h2>
          <p className="text-phantom-text-secondary leading-relaxed mb-8">
            Create disposable email aliases for every service you sign up for.
            Strip trackers, detect leaks, and stay anonymous.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-phantom-accent hover:bg-phantom-accent-hover text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Create Your First Alias
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
            <h1 className="text-xl font-bold text-phantom-text-primary">Email Aliases</h1>
            <p className="text-sm text-phantom-text-muted">
              {aliases.filter(a => a.status === 'active').length} active alias{aliases.filter(a => a.status === 'active').length !== 1 ? 'es' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-phantom-accent hover:bg-phantom-accent-hover text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New Alias
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

      {/* Alias cards */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {aliases.map((alias) => (
          <div
            key={alias.id}
            className="bg-phantom-card hover:bg-phantom-card-hover rounded-xl p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-phantom-text-primary truncate">
                  {alias.label}
                </p>
                {alias.service_label && (
                  <p className="text-sm text-phantom-text-muted mt-0.5">
                    {alias.service_label}
                  </p>
                )}
              </div>
              {alias.status === 'active' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-phantom-success-bg text-emerald-300 whitespace-nowrap">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-phantom-danger-bg text-red-300 whitespace-nowrap">
                  Killed
                </span>
              )}
            </div>

            {/* Alias email with copy button */}
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-phantom-text-muted font-mono truncate flex-1">
                {alias.alias_email}
              </p>
              <button
                onClick={() => handleCopy(alias.alias_email, alias.id)}
                className="shrink-0 text-xs text-phantom-accent hover:text-phantom-accent-hover transition-colors px-2 py-1 rounded"
                title="Copy alias email"
              >
                {copiedId === alias.id ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Actions */}
            {alias.status === 'active' && (
              <div className="mt-3 pt-3 border-t border-phantom-border/50">
                <button
                  onClick={() => setDeleteTarget(alias.id)}
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  Deactivate
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add new button */}
        <button
          onClick={() => setShowCreate(true)}
          className="w-full border-2 border-dashed border-phantom-border hover:border-phantom-accent/50 rounded-xl p-4 text-phantom-text-muted hover:text-phantom-accent transition-colors"
        >
          + New Alias
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
              Create Email Alias
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="alias-label" className="block text-sm font-semibold text-phantom-text-secondary mb-1.5">
                  Label
                </label>
                <input
                  id="alias-label"
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Shopping, Newsletter"
                  className="w-full rounded-lg bg-[#312E81] border border-phantom-border px-4 py-3 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label htmlFor="alias-service" className="block text-sm font-semibold text-phantom-text-secondary mb-1.5">
                  Service (optional)
                </label>
                <input
                  id="alias-service"
                  type="text"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="e.g., Amazon, Spotify"
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
                disabled={creating || !newLabel.trim()}
                className="bg-phantom-accent hover:bg-phantom-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
              >
                {creating && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                Create Alias
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
              Deactivate Alias?
            </h3>
            <p className="text-sm text-phantom-text-secondary mb-6">
              This alias will stop receiving emails. Any future emails sent to it will be lost.
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
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
