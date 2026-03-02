'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';

interface ScanResult {
  id: string;
  stale_aliases: number;
  spam_only_aliases?: number;
  unused_phones: number;
  auto_killed?: number;
  created_at: string;
}

interface ScanResponse {
  scan_id: string;
  stale_count: number;
  total_scanned: number;
  stale_identities: Array<{ identity_id: string; reason: string }>;
}

interface KillResponse {
  killed_count: number;
  requested_count: number;
}

export default function AutopilotPage() {
  const [latestScan, setLatestScan] = useState<ScanResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [killLoading, setKillLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [killResult, setKillResult] = useState<KillResponse | null>(null);
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  // Settings (visual only, not persisted to backend)
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [autoKillDays, setAutoKillDays] = useState(90);

  const fetchLatestResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const res = await apiFetch('/api/v2/autopilot/results');
      if (res.ok) {
        const data = await res.json();
        setLatestScan(data.scan);
      }
      // 404 just means no scan yet, not an error
    } catch {
      // Silently fail on initial load
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLatestResults();
  }, [fetchLatestResults]);

  const handleRunScan = async () => {
    setScanLoading(true);
    setError(null);
    setScanResponse(null);
    setKillResult(null);

    try {
      const res = await apiFetch('/api/v2/autopilot/scan', {
        method: 'POST',
      });

      if (res.ok) {
        const data: ScanResponse = await res.json();
        setScanResponse(data);
        // Refresh the latest results
        await fetchLatestResults();
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

  const handleKill = async () => {
    if (!scanResponse?.stale_identities.length) return;

    setKillLoading(true);
    setError(null);

    try {
      const identityIds = scanResponse.stale_identities.map(
        (s) => s.identity_id
      );

      const res = await apiFetch('/api/v2/autopilot/kill', {
        method: 'POST',
        body: JSON.stringify({ identity_ids: identityIds }),
      });

      if (res.ok) {
        const data: KillResponse = await res.json();
        setKillResult(data);
        setShowKillConfirm(false);
        setScanResponse(null);
        await fetchLatestResults();
      } else {
        const err = await res.json();
        setError(err.error || 'Kill failed. Please try again.');
      }
    } catch {
      setError('Network error. Could not kill identities.');
    } finally {
      setKillLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#E0E7FF]">Autopilot</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {killResult && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-4">
          <p className="text-emerald-300 text-sm">
            Successfully killed {killResult.killed_count} of{' '}
            {killResult.requested_count} stale identities.
          </p>
        </div>
      )}

      {/* Scan Section */}
      <div className="bg-[#1E1B4B] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#E0E7FF]">
            Scan Results
          </h2>
          {latestScan && (
            <span className="text-xs text-[#818CF8]">
              Last scan:{' '}
              {new Date(latestScan.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <p className="text-sm text-[#A5B4FC] mb-5">
          Scan your identities to find stale aliases, spam-only addresses, and
          unused phone numbers that can be safely removed.
        </p>

        <button
          onClick={handleRunScan}
          disabled={scanLoading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors mb-5"
        >
          {scanLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Run Scan
            </>
          )}
        </button>

        {/* Stats Grid */}
        {resultsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : latestScan ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Stale Aliases"
              value={latestScan.stale_aliases}
              color="amber"
            />
            <StatCard
              label="Spam-Only"
              value={latestScan.spam_only_aliases ?? 0}
              color="orange"
            />
            <StatCard
              label="Unused Phones"
              value={latestScan.unused_phones}
              color="red"
            />
            <StatCard
              label="Auto-Killed"
              value={latestScan.auto_killed ?? 0}
              color="emerald"
            />
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-[#818CF8] text-sm">
              No scan results yet. Run your first scan above.
            </p>
          </div>
        )}
      </div>

      {/* Kill Section */}
      <div className="bg-[#1E1B4B] rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[#E0E7FF] mb-2">
          Kill Stale Identities
        </h2>
        <p className="text-sm text-[#A5B4FC] mb-5">
          Deactivate identities flagged as stale by the scan. This will stop
          forwarding for those aliases.
        </p>

        {scanResponse && scanResponse.stale_identities.length > 0 ? (
          <>
            <div className="bg-[#0F0D23] rounded-xl p-4 mb-4">
              <p className="text-sm text-[#A5B4FC] mb-2">
                Found <span className="font-bold text-amber-300">{scanResponse.stale_count}</span> stale
                identities out of {scanResponse.total_scanned} scanned.
              </p>
              <ul className="space-y-1">
                {scanResponse.stale_identities.slice(0, 5).map((item) => (
                  <li
                    key={item.identity_id}
                    className="text-xs text-[#818CF8] truncate"
                  >
                    {item.identity_id.slice(0, 8)}... &mdash; {item.reason}
                  </li>
                ))}
                {scanResponse.stale_identities.length > 5 && (
                  <li className="text-xs text-[#818CF8]">
                    ...and {scanResponse.stale_identities.length - 5} more
                  </li>
                )}
              </ul>
            </div>

            {showKillConfirm ? (
              <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-300 mb-3">
                  Are you sure you want to kill{' '}
                  {scanResponse.stale_identities.length} stale identities? This
                  will deactivate them immediately.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowKillConfirm(false)}
                    className="flex-1 bg-[#312E81] hover:bg-[#3730A3] text-[#A5B4FC] font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleKill}
                    disabled={killLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    {killLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Confirm Kill'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowKillConfirm(true)}
                className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-800 text-red-400 font-semibold py-3.5 rounded-xl transition-colors"
              >
                Kill {scanResponse.stale_identities.length} Stale Identities
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-[#818CF8] text-sm">
              {scanResponse
                ? 'No stale identities found. Everything looks clean.'
                : 'Run a scan first to identify stale identities.'}
            </p>
          </div>
        )}
      </div>

      {/* Settings Section */}
      <div className="bg-[#1E1B4B] rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[#E0E7FF] mb-4">
          Settings
        </h2>

        {/* Autopilot Toggle */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-[#E0E7FF]">
              Enable Autopilot
            </p>
            <p className="text-xs text-[#818CF8] mt-0.5">
              Automatically scan and clean stale identities
            </p>
          </div>
          <button
            onClick={() => setAutopilotEnabled(!autopilotEnabled)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              autopilotEnabled ? 'bg-indigo-500' : 'bg-[#312E81]'
            }`}
            aria-label="Toggle autopilot"
          >
            <div
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                autopilotEnabled ? 'translate-x-5.5 left-0' : 'left-0.5'
              }`}
              style={{
                transform: autopilotEnabled
                  ? 'translateX(22px)'
                  : 'translateX(0px)',
              }}
            />
          </button>
        </div>

        {/* Auto-Kill Days */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#E0E7FF]">
              Auto-Kill Threshold
            </p>
            <p className="text-xs text-[#818CF8] mt-0.5">
              Days of inactivity before auto-kill
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoKillDays(Math.max(30, autoKillDays - 30))}
              className="w-8 h-8 flex items-center justify-center bg-[#312E81] hover:bg-[#3730A3] rounded-lg text-[#A5B4FC] font-bold transition-colors"
            >
              -
            </button>
            <span className="w-12 text-center text-sm font-semibold text-[#E0E7FF]">
              {autoKillDays}d
            </span>
            <button
              onClick={() => setAutoKillDays(Math.min(365, autoKillDays + 30))}
              className="w-8 h-8 flex items-center justify-center bg-[#312E81] hover:bg-[#3730A3] rounded-lg text-[#A5B4FC] font-bold transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <p className="text-xs text-[#818CF8]/60 mt-4">
          Settings are saved locally and will be connected to backend in a future
          update.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'amber' | 'orange' | 'red' | 'emerald';
}) {
  const colorClasses = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    orange: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    red: 'bg-red-500/10 border-red-500/30 text-red-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  };

  const valueColorClasses = {
    amber: 'text-amber-300',
    orange: 'text-orange-300',
    red: 'text-red-300',
    emerald: 'text-emerald-300',
  };

  return (
    <div
      className={`${colorClasses[color]} border rounded-xl p-4 text-center`}
    >
      <p className={`text-3xl font-bold ${valueColorClasses[color]}`}>
        {value}
      </p>
      <p className="text-xs text-[#A5B4FC] mt-1">{label}</p>
    </div>
  );
}
