'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface StaleIdentity {
  identity_id: string;
  type: 'stale_alias' | 'spam_only' | 'unused_phone';
  label: string;
  last_activity: string | null;
  reason: string;
}

interface ScanResponse {
  scan_id: string;
  stale_count: number;
  total_scanned: number;
  stale_identities: StaleIdentity[];
}

interface ScanHistoryEntry {
  id: string;
  stale_aliases: number;
  spam_only_aliases: number;
  unused_phones: number;
  auto_killed: number;
  created_at: string;
}

interface KillResponse {
  killed_count: number;
  requested_count: number;
}

export default function AutopilotPage() {
  const router = useRouter();
  const [scanLoading, setScanLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [killResult, setKillResult] = useState<KillResponse | null>(null);
  const [killingIds, setKillingIds] = useState<Set<string>>(new Set());
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);

  // Visual-only settings
  const [autoKillEnabled, setAutoKillEnabled] = useState(false);
  const [autoKillDays, setAutoKillDays] = useState(90);

  const fetchResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const res = await apiFetch('/api/v2/autopilot/results');
      if (res.ok) {
        const data = await res.json();
        if (data.scan) {
          setScanHistory((prev) => {
            const exists = prev.find((s) => s.id === data.scan.id);
            if (exists) return prev;
            return [data.scan, ...prev].slice(0, 10);
          });
        }
      } else if (res.status === 401) {
        router.push('/');
      }
    } catch {
      // Silently fail on initial load
    } finally {
      setResultsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleRunScan = async () => {
    setScanLoading(true);
    setError(null);
    setScanResponse(null);
    setKillResult(null);

    try {
      const res = await apiFetch('/api/v2/autopilot/scan', { method: 'POST' });
      if (res.ok) {
        const data: ScanResponse = await res.json();
        setScanResponse(data);
        await fetchResults();
      } else {
        const err = await res.json();
        setError(err.error || 'Scan failed. Please try again.');
      }
    } catch {
      setError('Network error. Could not run scan.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleKillSingle = async (identityId: string) => {
    setKillingIds((prev) => new Set(prev).add(identityId));
    setError(null);

    try {
      const res = await apiFetch('/api/v2/autopilot/kill', {
        method: 'POST',
        body: JSON.stringify({ identity_ids: [identityId] }),
      });

      if (res.ok) {
        setScanResponse((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stale_count: prev.stale_count - 1,
            stale_identities: prev.stale_identities.filter((s) => s.identity_id !== identityId),
          };
        });
      } else {
        const err = await res.json();
        setError(err.error || 'Kill failed.');
      }
    } catch {
      setError('Network error. Could not kill identity.');
    } finally {
      setKillingIds((prev) => {
        const next = new Set(prev);
        next.delete(identityId);
        return next;
      });
    }
  };

  const handleKillAll = async () => {
    if (!scanResponse?.stale_identities.length) return;
    const ids = scanResponse.stale_identities.map((s) => s.identity_id);
    setKillingIds(new Set(ids));
    setError(null);

    try {
      const res = await apiFetch('/api/v2/autopilot/kill', {
        method: 'POST',
        body: JSON.stringify({ identity_ids: ids }),
      });

      if (res.ok) {
        const data: KillResponse = await res.json();
        setKillResult(data);
        setScanResponse(null);
        await fetchResults();
      } else {
        const err = await res.json();
        setError(err.error || 'Kill failed.');
      }
    } catch {
      setError('Network error. Could not kill identities.');
    } finally {
      setKillingIds(new Set());
    }
  };

  const staleAliases = scanResponse?.stale_identities.filter((s) => s.type === 'stale_alias') || [];
  const spamOnly = scanResponse?.stale_identities.filter((s) => s.type === 'spam_only') || [];
  const unusedPhones = scanResponse?.stale_identities.filter((s) => s.type === 'unused_phone') || [];
  const totalStale = scanResponse?.stale_count ?? 0;
  const totalScanned = scanResponse?.total_scanned ?? 0;
  const reductionPct = totalScanned > 0 ? Math.round((totalStale / totalScanned) * 100) : 0;

  const hasResults = scanResponse && scanResponse.stale_identities.length > 0;
  const isEmpty = !resultsLoading && !scanResponse && scanHistory.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e2e8f0]">Autopilot</h1>
          <p className="text-sm text-[#64748b] mt-0.5">Automated identity hygiene</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20">
          SCAN
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#ef4444] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#ef4444]">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-[#ef4444]/50 hover:text-[#ef4444] transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Kill Success */}
      {killResult && (
        <div className="bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#22c55e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[#22c55e]">
              Killed <span className="font-mono tabular-nums font-bold">{killResult.killed_count}</span> of <span className="font-mono tabular-nums">{killResult.requested_count}</span> stale identities.
            </p>
          </div>
          <button onClick={() => setKillResult(null)} className="text-[#22c55e]/50 hover:text-[#22c55e] transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#e2e8f0] mb-2">Run your first scan</h2>
          <p className="text-sm text-[#64748b] max-w-xs mx-auto mb-6 leading-relaxed">
            Scan your identities to find stale aliases, spam-only addresses, and unused phone numbers that can be safely removed.
          </p>
          <button
            onClick={handleRunScan}
            disabled={scanLoading}
            className="inline-flex items-center gap-2 bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:cursor-not-allowed"
          >
            {scanLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Run Scan
              </>
            )}
          </button>
        </div>
      )}

      {/* Scan Button (when not empty state) */}
      {!isEmpty && (
        <button
          onClick={handleRunScan}
          disabled={scanLoading}
          className="w-full flex items-center justify-center gap-3 bg-[#6366f1] hover:bg-[#5558e6] disabled:bg-[#6366f1]/20 disabled:text-[#6366f1]/40 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:cursor-not-allowed"
        >
          {scanLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scanning identities...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Run Scan
            </>
          )}
        </button>
      )}

      {/* Recommendation Cards */}
      {hasResults && (
        <div className="grid grid-cols-1 gap-3">
          {totalStale > 0 && (
            <div className="bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#22c55e]">
                    Kill <span className="font-mono tabular-nums font-bold">{totalStale}</span> stale {totalStale === 1 ? 'identity' : 'identities'} to reduce footprint by <span className="font-mono tabular-nums font-bold">{reductionPct}%</span>
                  </p>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    <span className="font-mono tabular-nums">{totalScanned}</span> identities scanned
                  </p>
                </div>
              </div>
              <button
                onClick={handleKillAll}
                disabled={killingIds.size > 0}
                className="shrink-0 text-xs font-semibold text-[#22c55e] border border-[#22c55e]/20 hover:bg-[#22c55e]/10 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                Kill All
              </button>
            </div>
          )}

          {staleAliases.length > 0 && (
            <RecommendationChip
              label={`${staleAliases.length} stale ${staleAliases.length === 1 ? 'alias' : 'aliases'}`}
              color="amber"
            />
          )}
          {spamOnly.length > 0 && (
            <RecommendationChip
              label={`${spamOnly.length} spam-only ${spamOnly.length === 1 ? 'alias' : 'aliases'}`}
              color="amber"
            />
          )}
          {unusedPhones.length > 0 && (
            <RecommendationChip
              label={`${unusedPhones.length} unused ${unusedPhones.length === 1 ? 'phone' : 'phones'}`}
              color="red"
            />
          )}
        </div>
      )}

      {/* Results Table */}
      {hasResults && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl overflow-hidden card-glow">
          <div className="px-5 py-4 border-b border-[#1f2937] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">
              Scan Results
            </h2>
            <span className="text-xs font-mono tabular-nums text-[#64748b]">
              {scanResponse!.stale_identities.length} found
            </span>
          </div>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2.5 bg-[#0a0e17] border-b border-[#1f2937] text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">
            <div className="col-span-4">Identity</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Last Activity</div>
            <div className="col-span-2">Recommendation</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-[#1f2937]">
            {scanResponse!.stale_identities.map((identity) => {
              const isKilling = killingIds.has(identity.identity_id);
              const typeLabel = identity.type === 'stale_alias' ? 'Stale' : identity.type === 'spam_only' ? 'Spam' : 'Unused';
              const typeColor = identity.type === 'unused_phone' ? 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20' : 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20';

              return (
                <div
                  key={identity.identity_id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 px-5 py-3 table-row-hover items-center"
                >
                  {/* Identity */}
                  <div className="sm:col-span-4">
                    <p className="text-sm font-medium text-[#e2e8f0] truncate">
                      {identity.label || identity.identity_id.slice(0, 12) + '...'}
                    </p>
                    <p className="text-[11px] font-mono text-[#64748b] truncate sm:hidden">
                      {identity.identity_id.slice(0, 16)}...
                    </p>
                  </div>

                  {/* Type badge */}
                  <div className="sm:col-span-2 flex items-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeColor}`}>
                      {typeLabel}
                    </span>
                  </div>

                  {/* Last Activity */}
                  <div className="sm:col-span-2">
                    <span className="text-xs font-mono tabular-nums text-[#64748b]">
                      {identity.last_activity
                        ? new Date(identity.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Never'}
                    </span>
                  </div>

                  {/* Recommendation */}
                  <div className="sm:col-span-2">
                    <span className="text-xs text-[#94a3b8]">{identity.reason}</span>
                  </div>

                  {/* Action */}
                  <div className="sm:col-span-2 flex justify-start sm:justify-end mt-1 sm:mt-0">
                    <button
                      onClick={() => handleKillSingle(identity.identity_id)}
                      disabled={isKilling}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ef4444] border border-[#ef4444]/20 hover:bg-[#ef4444]/10 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                      {isKilling ? (
                        <div className="w-3 h-3 border-2 border-[#ef4444]/30 border-t-[#ef4444] rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      Kill
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No stale results after scan */}
      {scanResponse && scanResponse.stale_identities.length === 0 && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-8 text-center card-glow">
          <div className="w-14 h-14 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-base font-semibold text-[#e2e8f0] mb-1">All Clear</p>
          <p className="text-sm text-[#64748b]">
            No stale identities found. Scanned <span className="font-mono tabular-nums">{scanResponse.total_scanned}</span> identities.
          </p>
        </div>
      )}

      {/* Settings */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 card-glow">
        <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-5">
          Autopilot Settings
        </h2>

        {/* Auto-kill toggle */}
        <div className="flex items-center justify-between py-3 border-b border-[#1f2937]">
          <div>
            <p className="text-sm font-medium text-[#e2e8f0]">Auto-kill mode</p>
            <p className="text-xs text-[#64748b] mt-0.5">Automatically remove stale identities on scan</p>
          </div>
          <button
            onClick={() => setAutoKillEnabled(!autoKillEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              autoKillEnabled ? 'bg-[#6366f1]' : 'bg-[#1f2937]'
            }`}
            aria-label="Toggle auto-kill mode"
          >
            <div
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
              style={{ transform: autoKillEnabled ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        {/* Auto-kill threshold */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-[#e2e8f0]">Inactivity threshold</p>
            <p className="text-xs text-[#64748b] mt-0.5">Days before an identity is considered stale</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoKillDays(Math.max(30, autoKillDays - 30))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0a0e17] border border-[#1f2937] hover:border-[#374151] text-[#94a3b8] font-bold text-sm transition-colors"
            >
              -
            </button>
            <span className="w-14 text-center text-sm font-bold font-mono tabular-nums text-[#e2e8f0]">
              {autoKillDays}d
            </span>
            <button
              onClick={() => setAutoKillDays(Math.min(365, autoKillDays + 30))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0a0e17] border border-[#1f2937] hover:border-[#374151] text-[#94a3b8] font-bold text-sm transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[#64748b]/60 mt-3">
          Settings are saved locally. Backend integration in a future update.
        </p>
      </div>

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl overflow-hidden card-glow">
          <div className="px-5 py-4 border-b border-[#1f2937]">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">
              Scan History
            </h2>
          </div>
          <div className="divide-y divide-[#1f2937]">
            {scanHistory.map((scan) => {
              const total = scan.stale_aliases + (scan.spam_only_aliases ?? 0) + scan.unused_phones;
              return (
                <div key={scan.id} className="px-5 py-3 flex items-center justify-between table-row-hover">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${total > 0 ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'}`} />
                    <span className="text-xs font-mono tabular-nums text-[#94a3b8]">
                      {new Date(scan.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {scan.stale_aliases > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
                        {scan.stale_aliases} stale
                      </span>
                    )}
                    {(scan.spam_only_aliases ?? 0) > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
                        {scan.spam_only_aliases} spam
                      </span>
                    )}
                    {scan.unused_phones > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">
                        {scan.unused_phones} unused
                      </span>
                    )}
                    {scan.auto_killed > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                        {scan.auto_killed} killed
                      </span>
                    )}
                    {total === 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                        Clean
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading skeleton for initial load */}
      {resultsLoading && !scanResponse && scanHistory.length === 0 && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 animate-pulse">
          <div className="space-y-4">
            <div className="h-4 w-32 bg-[#1f2937] rounded" />
            <div className="h-10 w-full bg-[#1f2937] rounded-xl" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-[#1f2937] rounded" />
              <div className="h-3 w-3/4 bg-[#1f2937] rounded" />
              <div className="h-3 w-1/2 bg-[#1f2937] rounded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendationChip({ label, color }: { label: string; color: 'amber' | 'red' }) {
  const colors = {
    amber: 'bg-[#f59e0b]/5 border-[#f59e0b]/20 text-[#f59e0b]',
    red: 'bg-[#ef4444]/5 border-[#ef4444]/20 text-[#ef4444]',
  };
  const dotColors = {
    amber: 'bg-[#f59e0b]',
    red: 'bg-[#ef4444]',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${colors[color]}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dotColors[color]}`} />
      {label}
    </div>
  );
}
