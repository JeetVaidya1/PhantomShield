'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

// ---- Types ----

interface LeakDetection {
  id: string;
  identity_id: string;
  expected_sender: string;
  actual_sender_domain: string;
  actual_sender_email: string;
  detected_at: string;
  dismissed: boolean;
}

// ---- Sub-components ----

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-phantom-card border-l-4 border-l-phantom-border p-5 space-y-3"
        >
          <div className="flex justify-between">
            <div className="h-5 w-36 bg-phantom-border rounded" />
            <div className="h-4 w-20 bg-phantom-border rounded" />
          </div>
          <div className="h-4 w-56 bg-phantom-border rounded" />
          <div className="flex gap-2 pt-1">
            <div className="h-8 w-20 bg-phantom-border rounded-lg" />
            <div className="h-8 w-36 bg-phantom-border rounded-lg" />
            <div className="h-8 w-20 bg-phantom-border rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-900/30 flex items-center justify-center mb-5">
        <svg
          className="w-8 h-8 text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <p className="text-lg font-semibold text-phantom-text-primary mb-1">
        All Clear
      </p>
      <p className="text-phantom-text-secondary max-w-xs leading-relaxed">
        No suspicious activity detected. Your aliases are clean.
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-phantom-card border border-phantom-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-bold text-phantom-text-primary mb-2">
          {title}
        </h3>
        <p className="text-sm text-phantom-text-secondary mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-phantom-text-secondary hover:text-phantom-text-primary hover:bg-phantom-border/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeakCard({
  leak,
  onDismiss,
  onKillAlias,
}: {
  leak: LeakDetection;
  onDismiss: (id: string) => void;
  onKillAlias: (leak: LeakDetection) => void;
}) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);

  const date = new Date(leak.detected_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDismiss = async () => {
    setDismissing(true);
    await onDismiss(leak.id);
  };

  return (
    <div
      className="rounded-xl bg-phantom-card border-l-4 border-l-red-500 p-4 sm:p-5"
      aria-label={`Leak alert: ${leak.expected_sender} alias received email from ${leak.actual_sender_domain}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base sm:text-lg font-semibold text-phantom-text-primary">
          {leak.expected_sender}
        </h3>
        <span className="text-xs text-phantom-text-muted whitespace-nowrap shrink-0 mt-1">
          {date}
        </span>
      </div>

      {/* Sender info */}
      <p className="text-sm text-red-300 mb-4">
        Unexpected sender:{' '}
        <span className="font-medium">{leak.actual_sender_domain}</span>
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-phantom-border/60 text-phantom-text-secondary hover:bg-phantom-border hover:text-phantom-text-primary disabled:opacity-50 transition-colors"
          aria-label="Dismiss alert"
        >
          {dismissing ? 'Dismissing...' : 'Dismiss'}
        </button>
        <button
          onClick={() =>
            router.push(
              `/dashboard/gdpr?domain=${encodeURIComponent(leak.actual_sender_domain)}`
            )
          }
          className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-indigo-900/60 text-indigo-300 hover:bg-indigo-900 hover:text-indigo-200 transition-colors"
          aria-label="Send deletion request"
        >
          Send Deletion Request
        </button>
        <button
          onClick={() => onKillAlias(leak)}
          className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-phantom-danger-bg text-red-300 hover:bg-red-800 hover:text-red-200 transition-colors"
          aria-label="Kill alias"
        >
          Kill Alias
        </button>
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
  const [killingId, setKillingId] = useState<string | null>(null);

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
        throw new Error('Failed to load leak alerts');
      }

      const data: { leaks: LeakDetection[] } = await res.json();
      setLeaks(data.leaks || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchLeaks();
  }, [fetchLeaks]);

  const handleDismiss = useCallback(
    async (id: string) => {
      try {
        const res = await apiFetch(`/api/v2/leaks/${id}/dismiss`, {
          method: 'PATCH',
        });

        if (res.ok) {
          setLeaks((prev) => prev.filter((l) => l.id !== id));
        } else {
          setError('Failed to dismiss alert');
        }
      } catch {
        setError('Failed to dismiss alert');
      }
    },
    []
  );

  const handleKillAlias = useCallback(async () => {
    if (!killTarget) return;

    setKillingId(killTarget.identity_id);
    setKillTarget(null);

    try {
      const res = await apiFetch('/api/v2/autopilot/kill', {
        method: 'POST',
        body: JSON.stringify({ identity_id: killTarget.identity_id }),
      });

      if (res.ok) {
        // Remove all leaks for this identity
        setLeaks((prev) =>
          prev.filter((l) => l.identity_id !== killTarget.identity_id)
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to kill alias');
      }
    } catch {
      setError('Failed to kill alias');
    } finally {
      setKillingId(null);
    }
  }, [killTarget]);

  const activeLeaks = leaks.filter((l) => !l.dismissed);

  return (
    <div className="min-h-screen bg-phantom-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-phantom-bg/80 backdrop-blur-md border-b border-phantom-border/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-phantom-text-muted hover:text-phantom-text-primary transition-colors"
            aria-label="Back to dashboard"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-phantom-text-primary">
            Leak Alerts
          </h1>
          {activeLeaks.length > 0 && (
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
              {activeLeaks.length}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Error banner */}
        {error && (
          <div className="rounded-xl bg-phantom-danger-surface border border-red-900/40 px-4 py-3 mb-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400/60 hover:text-red-400 transition-colors shrink-0"
                aria-label="Dismiss error"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : activeLeaks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {activeLeaks.map((leak) => (
              <LeakCard
                key={leak.id}
                leak={leak}
                onDismiss={handleDismiss}
                onKillAlias={(l) => setKillTarget(l)}
              />
            ))}
          </div>
        )}

        {/* Killing indicator */}
        {killingId && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-phantom-card border border-phantom-border rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3">
            <svg
              className="animate-spin h-4 w-4 text-red-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-red-300">Killing alias...</span>
          </div>
        )}
      </main>

      {/* Kill confirm dialog */}
      {killTarget && (
        <ConfirmDialog
          title="Kill Alias"
          message={`Are you sure you want to permanently deactivate the alias for ${killTarget.expected_sender}? This cannot be undone.`}
          confirmLabel="Kill Alias"
          onConfirm={handleKillAlias}
          onCancel={() => setKillTarget(null)}
        />
      )}
    </div>
  );
}
