'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

// ---- Types ----

interface TrackerStats {
  total_trackers_blocked: number;
  total_links_cleaned: number;
  emails_processed: number;
  top_tracker_companies: { company: string; count: number }[];
  daily_trend: { date: string; trackers: number; emails: number }[];
}

interface LeakDetection {
  id: string;
  dismissed: boolean;
}

// ---- Sub-components ----

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-phantom-bg p-4 sm:p-6 animate-pulse">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Hero skeleton */}
        <div className="rounded-2xl bg-phantom-card p-8 flex flex-col items-center gap-3">
          <div className="h-16 w-40 bg-phantom-border rounded-lg" />
          <div className="h-5 w-52 bg-phantom-border rounded" />
          <div className="flex gap-8 mt-4">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-16 bg-phantom-border rounded" />
              <div className="h-3 w-20 bg-phantom-border rounded" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-16 bg-phantom-border rounded" />
              <div className="h-3 w-20 bg-phantom-border rounded" />
            </div>
          </div>
        </div>
        {/* Trend skeleton */}
        <div className="rounded-2xl bg-phantom-card p-6">
          <div className="h-5 w-32 bg-phantom-border rounded mb-4" />
          <div className="flex items-end gap-1 h-16">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-phantom-border rounded-sm"
                style={{ height: `${20 + Math.random() * 80}%` }}
              />
            ))}
          </div>
        </div>
        {/* Companies skeleton */}
        <div className="rounded-2xl bg-phantom-card p-6 space-y-4">
          <div className="h-5 w-48 bg-phantom-border rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-24 bg-phantom-border rounded" />
              <div className="flex-1 h-3 bg-phantom-border rounded-full" />
              <div className="h-4 w-8 bg-phantom-border rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-6xl mb-4" aria-hidden="true">
        &#128737;
      </div>
      <p className="text-phantom-text-secondary text-lg leading-relaxed max-w-sm">
        No trackers blocked yet. As you use your aliases, we&apos;ll show you who&apos;s tracking you.
      </p>
    </div>
  );
}

function Sparkline({ data }: { data: { date: string; trackers: number }[] }) {
  const max = Math.max(...data.map((d) => d.trackers), 1);
  return (
    <div
      className="flex items-end gap-[2px] h-16"
      aria-label="30-day tracker trend"
      role="img"
    >
      {data.map((d) => {
        const pct = Math.max((d.trackers / max) * 100, 3);
        return (
          <div
            key={d.date}
            className="flex-1 bg-phantom-accent rounded-sm min-h-[2px] transition-all duration-300 hover:bg-phantom-accent-hover"
            style={{ height: `${pct}%` }}
            title={`${d.date}: ${d.trackers} trackers`}
          />
        );
      })}
    </div>
  );
}

function CompanyBar({
  company,
  count,
  maxCount,
}: {
  company: string;
  count: number;
  maxCount: number;
}) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div
      className="flex items-center gap-3"
      aria-label={`${company}: ${count} trackers`}
    >
      <span className="w-28 sm:w-36 text-sm text-phantom-text-secondary truncate shrink-0">
        {company}
      </span>
      <div className="flex-1 h-3 bg-phantom-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-phantom-accent rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm font-medium text-phantom-text-secondary tabular-nums">
        {count}
      </span>
    </div>
  );
}

interface QuickLinkProps {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  badgeColor?: string;
}

function QuickLink({ href, label, icon, badge, badgeColor }: QuickLinkProps) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="flex items-center gap-3 rounded-xl bg-phantom-card hover:bg-phantom-card-hover border border-phantom-border/50 px-4 py-3.5 transition-colors w-full text-left group"
    >
      <span className="text-xl shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="text-sm font-medium text-phantom-text-primary group-hover:text-white transition-colors flex-1">
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            badgeColor || 'bg-phantom-accent text-white'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ---- Main Component ----

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<TrackerStats | null>(null);
  const [leakCount, setLeakCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsRes, leaksRes] = await Promise.all([
        apiFetch('/api/v2/trackers/stats'),
        apiFetch('/api/v2/leaks'),
      ]);

      if (statsRes.status === 401 || leaksRes.status === 401) {
        router.push('/');
        return;
      }

      if (!statsRes.ok) {
        throw new Error('Failed to load tracker stats');
      }

      const statsData: TrackerStats = await statsRes.json();
      setStats(statsData);

      if (leaksRes.ok) {
        const leaksData: { leaks: LeakDetection[] } = await leaksRes.json();
        setLeakCount(leaksData.leaks.filter((l) => !l.dismissed).length);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  const isEmpty = !stats || stats.emails_processed === 0;

  return (
    <div className="min-h-screen bg-phantom-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-phantom-bg/80 backdrop-blur-md border-b border-phantom-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-phantom-text-primary">
            Phantom Defender
          </h1>
          <button
            onClick={fetchData}
            className="text-sm text-phantom-text-muted hover:text-phantom-text-primary transition-colors"
            aria-label="Refresh data"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="rounded-xl bg-phantom-danger-surface border border-red-900/40 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {/* Hero stat */}
            <section className="rounded-2xl bg-phantom-card border border-phantom-border/30 p-6 sm:p-8 text-center">
              <p
                className="text-5xl sm:text-7xl font-extrabold text-phantom-text-primary tabular-nums"
                aria-label={`${stats!.total_trackers_blocked} total trackers blocked`}
              >
                {stats!.total_trackers_blocked.toLocaleString()}
              </p>
              <p className="mt-1 text-phantom-text-secondary text-sm sm:text-base">
                Trackers Blocked (30 days)
              </p>

              <div className="flex justify-center gap-10 sm:gap-16 mt-6">
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-phantom-text-primary tabular-nums">
                    {stats!.total_links_cleaned.toLocaleString()}
                  </p>
                  <p className="text-xs text-phantom-text-muted mt-0.5">Links Cleaned</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-phantom-text-primary tabular-nums">
                    {stats!.emails_processed.toLocaleString()}
                  </p>
                  <p className="text-xs text-phantom-text-muted mt-0.5">Emails Scanned</p>
                </div>
              </div>
            </section>

            {/* Leak alert card */}
            {leakCount > 0 && (
              <button
                onClick={() => router.push('/dashboard/leaks')}
                className="w-full rounded-2xl bg-phantom-danger-surface border border-red-900/40 p-5 flex items-center gap-4 hover:bg-red-950/60 transition-colors text-left"
              >
                <span className="text-3xl" aria-hidden="true">&#9888;</span>
                <div className="flex-1">
                  <p className="text-lg font-bold text-red-400">
                    {leakCount} Active Leak Alert{leakCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-red-300/70 mt-0.5">
                    Your data may have been shared without permission
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-red-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}

            {/* 30-day trend */}
            {stats!.daily_trend.length > 0 && (
              <section className="rounded-2xl bg-phantom-card border border-phantom-border/30 p-5 sm:p-6">
                <h2 className="text-base font-semibold text-phantom-text-primary mb-4">
                  30-Day Trend
                </h2>
                <Sparkline data={stats!.daily_trend} />
              </section>
            )}

            {/* Top tracker companies */}
            {stats!.top_tracker_companies.length > 0 && (
              <section className="rounded-2xl bg-phantom-card border border-phantom-border/30 p-5 sm:p-6">
                <h2 className="text-base font-semibold text-phantom-text-primary mb-4">
                  Top Tracker Companies
                </h2>
                <div className="space-y-3">
                  {stats!.top_tracker_companies.slice(0, 5).map((c) => (
                    <CompanyBar
                      key={c.company}
                      company={c.company}
                      count={c.count}
                      maxCount={stats!.top_tracker_companies[0].count}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Quick links */}
        <section>
          <h2 className="text-base font-semibold text-phantom-text-primary mb-3">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickLink
              href="/dashboard/leaks"
              label="Leak Alerts"
              icon="&#128680;"
              badge={leakCount}
              badgeColor="bg-red-500 text-white"
            />
            <QuickLink
              href="/dashboard/honeypots"
              label="Honeypots"
              icon="&#127855;"
            />
            <QuickLink
              href="/dashboard/gdpr"
              label="GDPR Requests"
              icon="&#128220;"
            />
            <QuickLink
              href="/dashboard/scores"
              label="Privacy Scores"
              icon="&#127919;"
            />
            <QuickLink
              href="/dashboard/autopilot"
              label="Autopilot Scan"
              icon="&#129302;"
            />
            <QuickLink
              href="/dashboard/nuke"
              label="Emergency Nuke"
              icon="&#9762;"
            />
            <QuickLink
              href="/dashboard/export"
              label="Export Data"
              icon="&#128230;"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
