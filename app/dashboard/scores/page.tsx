'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';

interface CompanyScore {
  company_domain: string;
  company_name?: string;
  privacy_score?: number;
  leak_rate?: number;
  total_aliases?: number;
  leak_detections?: number;
  tracker_count?: number;
  gdpr_response_time?: number;
  last_computed_at?: string;
  last_updated?: string;
  status?: string;
  message?: string;
}

interface SearchHistoryEntry {
  domain: string;
  company_name: string | null;
  score: number | null;
  timestamp: number;
}

function getScoreColor(score: number): string {
  if (score > 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score > 70) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

function getScoreLabelColor(score: number): string {
  if (score > 70) return 'bg-[#22c55e]/10 text-[#22c55e]';
  if (score >= 40) return 'bg-[#f59e0b]/10 text-[#f59e0b]';
  return 'bg-[#ef4444]/10 text-[#ef4444]';
}

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 50; // r=50, C=314.16

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="#1f2937"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * score / 100)}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono tabular-nums font-bold"
          style={{ fontSize: size * 0.25, color }}
        >
          {score}
        </span>
        <span className="text-[#64748b] text-xs mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-[#6366f1]"
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
  );
}

const EXAMPLE_DOMAINS = ['google.com', 'facebook.com', 'amazon.com'];

export default function ScoresPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<CompanyScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  const searchDomain = useCallback(async (domain: string) => {
    const cleaned = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!cleaned) return;

    setQuery(cleaned);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiFetch(
        `/api/v2/company-scores/${encodeURIComponent(cleaned)}`
      );

      if (res.status === 404) {
        setError('No privacy score available for this domain yet.');
        addToHistory(cleaned, null, null);
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch score');
      }

      const data: CompanyScore = await res.json();
      setResult(data);

      const hasScore =
        data.privacy_score !== undefined && data.status !== 'insufficient_data';
      addToHistory(
        cleaned,
        data.company_name || null,
        hasScore ? data.privacy_score! : null
      );
    } catch {
      setError('Failed to look up this domain. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  function addToHistory(
    domain: string,
    company_name: string | null,
    score: number | null
  ) {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.domain !== domain);
      return [
        { domain, company_name, score, timestamp: Date.now() },
        ...filtered,
      ].slice(0, 10);
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchDomain(query);
  };

  const hasFullScore =
    result &&
    result.privacy_score !== undefined &&
    result.status !== 'insufficient_data';

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Privacy Scores</h1>
        <p className="text-sm text-[#64748b] mt-1">
          Look up how well companies protect your data
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Search Bar */}
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748b]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a company domain..."
              className="w-full bg-[#111827] border border-[#1f2937] rounded-xl pl-12 pr-4 py-3.5 text-[#e2e8f0] placeholder-[#64748b]/60 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50 focus:border-[#6366f1] transition-all text-sm"
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Spinner />
              </div>
            )}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-[#ef4444]">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-[#ef4444]/60 hover:text-[#ef4444] ml-4 shrink-0"
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
        )}

        {/* Insufficient data */}
        {result && result.status === 'insufficient_data' && (
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[#f59e0b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#e2e8f0] mb-1">
              Insufficient Data
            </h3>
            <p className="text-sm text-[#94a3b8] mb-1">
              {result.company_domain}
            </p>
            <p className="text-sm text-[#64748b] max-w-sm mx-auto">
              Not enough aliases have been created for this company to compute a
              reliable privacy score. At least 10 aliases with activity data are
              needed.
            </p>
          </div>
        )}

        {/* Score Display Card */}
        {hasFullScore && (
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 card-glow">
            {/* Company header + ring */}
            <div className="flex flex-col items-center mb-6">
              <ScoreRing score={result.privacy_score!} />
              <h3 className="text-xl font-bold text-[#e2e8f0] mt-4">
                {result.company_name || result.company_domain}
              </h3>
              {result.company_name && (
                <p className="text-sm text-[#64748b] mt-0.5">
                  {result.company_domain}
                </p>
              )}
              <span
                className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold ${getScoreLabelColor(result.privacy_score!)}`}
              >
                {getScoreLabel(result.privacy_score!)}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Leak Rate */}
              <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-4">
                <p className="text-xs text-[#64748b] mb-1">Leak Rate</p>
                <p
                  className="text-2xl font-mono tabular-nums font-bold"
                  style={{
                    color:
                      result.leak_rate !== undefined
                        ? result.leak_rate > 0.3
                          ? '#ef4444'
                          : result.leak_rate > 0.1
                            ? '#f59e0b'
                            : '#22c55e'
                        : '#94a3b8',
                  }}
                >
                  {result.leak_rate !== undefined
                    ? `${(result.leak_rate * 100).toFixed(1)}%`
                    : '--'}
                </p>
              </div>

              {/* GDPR Response Time */}
              <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-4">
                <p className="text-xs text-[#64748b] mb-1">GDPR Response</p>
                <p className="text-2xl font-mono tabular-nums font-bold text-[#e2e8f0]">
                  {result.gdpr_response_time !== undefined
                    ? `${result.gdpr_response_time}d`
                    : '--'}
                </p>
              </div>

              {/* Tracker Count */}
              <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-4">
                <p className="text-xs text-[#64748b] mb-1">Trackers Found</p>
                <p className="text-2xl font-mono tabular-nums font-bold text-[#e2e8f0]">
                  {result.tracker_count !== undefined
                    ? result.tracker_count.toLocaleString()
                    : '--'}
                </p>
              </div>

              {/* Total Aliases */}
              <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-4">
                <p className="text-xs text-[#64748b] mb-1">Aliases Monitored</p>
                <p className="text-2xl font-mono tabular-nums font-bold text-[#6366f1]">
                  {result.total_aliases !== undefined
                    ? result.total_aliases.toLocaleString()
                    : '--'}
                </p>
              </div>
            </div>

            {/* Last updated */}
            {(result.last_computed_at || result.last_updated) && (
              <p className="text-xs text-[#64748b] text-center mt-4">
                Last updated{' '}
                {new Date(
                  (result.last_computed_at || result.last_updated)!
                ).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        )}

        {/* Recent Searches */}
        {history.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
              Recent Searches
            </h3>
            <div className="space-y-2">
              {history.map((entry) => (
                <button
                  key={entry.domain}
                  onClick={() => searchDomain(entry.domain)}
                  className="w-full text-left bg-[#111827] border border-[#1f2937] hover:border-[#6366f1]/30 rounded-xl px-4 py-3 flex items-center justify-between transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#e2e8f0] truncate">
                      {entry.company_name || entry.domain}
                    </p>
                    {entry.company_name && (
                      <p className="text-xs text-[#64748b] truncate">
                        {entry.domain}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 ml-3">
                    {entry.score !== null ? (
                      <span
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full font-mono tabular-nums text-sm font-bold"
                        style={{
                          backgroundColor: `${getScoreColor(entry.score)}15`,
                          color: getScoreColor(entry.score),
                        }}
                      >
                        {entry.score}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-[#64748b] bg-[#1f2937]">
                        N/A
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Default State */}
        {history.length === 0 && !result && !error && !loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#6366f1]/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#6366f1]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#e2e8f0] mb-2">
              Look up any company&apos;s privacy score
            </h2>
            <p className="text-sm text-[#94a3b8] max-w-sm mx-auto mb-8">
              Search a domain to see how well a company protects your data,
              based on real leak and tracker data from Phantom Defender users.
            </p>

            {/* Example domain chips */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-[#64748b] mr-1">Try:</span>
              {EXAMPLE_DOMAINS.map((domain) => (
                <button
                  key={domain}
                  onClick={() => searchDomain(domain)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#111827] border border-[#1f2937] text-[#94a3b8] hover:border-[#6366f1]/40 hover:text-[#e2e8f0] transition-all"
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
