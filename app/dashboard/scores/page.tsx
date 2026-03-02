'use client';

import { useState, useCallback } from 'react';

interface CompanyScore {
  company_domain: string;
  company_name?: string;
  privacy_score?: number;
  leak_rate?: number;
  total_aliases?: number;
  leak_detections?: number;
  last_computed_at?: string;
  status?: string;
  message?: string;
}

interface SearchHistoryEntry {
  domain: string;
  company_name: string | null;
  score: number | null;
  timestamp: number;
}

function getScoreColor(score: number): { ring: string; text: string; bg: string } {
  if (score <= 30) return { ring: 'text-red-500', text: 'text-red-400', bg: 'bg-red-500/10' };
  if (score <= 60) return { ring: 'text-amber-400', text: 'text-amber-300', bg: 'bg-amber-400/10' };
  return { ring: 'text-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10' };
}

function getScoreLabel(score: number): string {
  if (score <= 30) return 'Poor';
  if (score <= 60) return 'Fair';
  if (score <= 80) return 'Good';
  return 'Excellent';
}

function ScoreRing({ score }: { score: number }) {
  const colors = getScoreColor(score);
  // SVG circle math: radius=45, circumference=2*pi*45=282.74
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-phantom-border"
        />
        {/* Score ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${colors.ring} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${colors.text}`}>
          {score}
        </span>
        <span className="text-xs text-phantom-text-muted">/ 100</span>
      </div>
    </div>
  );
}

export default function ScoresPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<CompanyScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  const searchDomain = useCallback(async (domain: string) => {
    const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleaned) return;

    setLoading(true);
    setError(null);
    setNotFound(false);
    setResult(null);

    try {
      // Public endpoint, no auth needed -- fetch directly
      const res = await fetch(`/api/v2/company-scores/${encodeURIComponent(cleaned)}`);

      if (res.status === 404) {
        setNotFound(true);
        // Still add to history as "not found"
        setHistory((prev) => {
          const filtered = prev.filter((h) => h.domain !== cleaned);
          return [{ domain: cleaned, company_name: null, score: null, timestamp: Date.now() }, ...filtered].slice(0, 10);
        });
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch score');
      }

      const data: CompanyScore = await res.json();
      setResult(data);

      // Add to search history
      const hasScore = data.privacy_score !== undefined && data.status !== 'insufficient_data';
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.domain !== cleaned);
        return [
          {
            domain: cleaned,
            company_name: data.company_name || null,
            score: hasScore ? data.privacy_score! : null,
            timestamp: Date.now(),
          },
          ...filtered,
        ].slice(0, 10);
      });
    } catch {
      setError('Failed to look up this domain. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchDomain(query);
  };

  const hasFullScore = result && result.privacy_score !== undefined && result.status !== 'insufficient_data';

  return (
    <div className="min-h-screen bg-phantom-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-phantom-bg/80 backdrop-blur-sm border-b border-phantom-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-phantom-text-primary">Privacy Scores</h1>
          <p className="text-sm text-phantom-text-muted">
            Look up how well companies protect your data
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Search */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-phantom-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter a domain (e.g., facebook.com)"
                className="w-full rounded-lg bg-phantom-card border border-phantom-border pl-10 pr-4 py-3 text-phantom-text-primary placeholder-phantom-text-muted/50 focus:outline-none focus:ring-2 focus:ring-phantom-accent focus:border-transparent transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-phantom-accent hover:bg-phantom-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-3 rounded-lg transition-colors shrink-0 flex items-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-phantom-danger-surface border border-red-800/40 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Not found */}
        {notFound && (
          <div className="bg-phantom-card rounded-xl p-6 text-center mb-6">
            <div className="text-4xl mb-3">&#128269;</div>
            <h3 className="text-lg font-semibold text-phantom-text-primary mb-1">
              No Score Available
            </h3>
            <p className="text-sm text-phantom-text-secondary">
              We don&apos;t have enough data to compute a privacy score for this domain yet.
              As more users create aliases for this service, a score will become available.
            </p>
          </div>
        )}

        {/* Insufficient data result */}
        {result && result.status === 'insufficient_data' && (
          <div className="bg-phantom-card rounded-xl p-6 text-center mb-6">
            <div className="text-4xl mb-3">&#128202;</div>
            <h3 className="text-lg font-semibold text-phantom-text-primary mb-1">
              Insufficient Data
            </h3>
            <p className="text-sm text-phantom-text-secondary mb-1">
              {result.company_domain}
            </p>
            <p className="text-sm text-phantom-text-muted">
              Not enough aliases have been created for this company to compute a reliable privacy score.
              We need at least 10 aliases with activity data.
            </p>
          </div>
        )}

        {/* Full Score Result */}
        {hasFullScore && (
          <div className="bg-phantom-card rounded-xl p-6 mb-6">
            {/* Company info + score */}
            <div className="text-center mb-6">
              <ScoreRing score={result.privacy_score!} />
              <h3 className="text-xl font-bold text-phantom-text-primary mt-4">
                {result.company_name || result.company_domain}
              </h3>
              <p className="text-sm text-phantom-text-muted mt-0.5">
                {result.company_domain}
              </p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getScoreColor(result.privacy_score!).bg} ${getScoreColor(result.privacy_score!).text}`}>
                {getScoreLabel(result.privacy_score!)}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#312E81]/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-phantom-text-primary">
                  {result.total_aliases ?? '-'}
                </p>
                <p className="text-xs text-phantom-text-muted mt-0.5">Total Aliases</p>
              </div>
              <div className="bg-[#312E81]/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-phantom-text-primary">
                  {result.leak_detections ?? '-'}
                </p>
                <p className="text-xs text-phantom-text-muted mt-0.5">Leak Detections</p>
              </div>
              <div className="bg-[#312E81]/50 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${
                  result.leak_rate !== undefined
                    ? result.leak_rate > 0.3
                      ? 'text-red-400'
                      : result.leak_rate > 0.1
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    : 'text-phantom-text-primary'
                }`}>
                  {result.leak_rate !== undefined
                    ? `${(result.leak_rate * 100).toFixed(1)}%`
                    : '-'}
                </p>
                <p className="text-xs text-phantom-text-muted mt-0.5">Leak Rate</p>
              </div>
              <div className="bg-[#312E81]/50 rounded-lg p-3 text-center">
                <p className="text-xs text-phantom-text-muted">Last Updated</p>
                <p className="text-sm font-medium text-phantom-text-secondary mt-1">
                  {result.last_computed_at
                    ? new Date(result.last_computed_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent searches */}
        {history.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-phantom-text-secondary uppercase tracking-wider mb-3">
              Recent Searches
            </h3>
            <div className="space-y-2">
              {history.map((entry) => (
                <button
                  key={entry.domain + entry.timestamp}
                  onClick={() => {
                    setQuery(entry.domain);
                    searchDomain(entry.domain);
                  }}
                  className="w-full text-left bg-phantom-card hover:bg-phantom-card-hover rounded-lg p-3 flex items-center justify-between transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-phantom-text-primary truncate">
                      {entry.company_name || entry.domain}
                    </p>
                    {entry.company_name && (
                      <p className="text-xs text-phantom-text-muted truncate">
                        {entry.domain}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 ml-3">
                    {entry.score !== null ? (
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${getScoreColor(entry.score).bg} ${getScoreColor(entry.score).text}`}>
                        {entry.score}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-phantom-text-muted bg-phantom-border/50">
                        N/A
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Initial state hint (no searches yet, no result) */}
        {history.length === 0 && !result && !notFound && !loading && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">&#128737;</div>
            <h2 className="text-xl font-bold text-phantom-text-primary mb-2">
              Company Privacy Lookup
            </h2>
            <p className="text-phantom-text-secondary text-sm max-w-xs mx-auto leading-relaxed">
              Enter a company domain above to see their privacy score based on
              real leak data from Phantom Defender users.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
