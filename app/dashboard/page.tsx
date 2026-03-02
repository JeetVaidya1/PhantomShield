'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

interface TrackerStats {
  total_trackers_blocked: number;
  total_links_cleaned: number;
  emails_processed: number;
  top_tracker_companies: { company: string; count: number }[];
  daily_trend: { date: string; trackers: number; emails: number }[];
}

interface LeakEntry {
  id: string;
  dismissed: boolean;
  created_at?: string;
}

interface AliasEntry {
  id: string;
  status: string;
  alias_email?: string;
  created_at?: string;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  description: string;
  type: 'tracker' | 'leak' | 'alias';
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

function ShieldIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function EyeSlashIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function ExclamationIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function EnvelopeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function ChartIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ArrowUpIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  );
}

function ArrowDownIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
    </svg>
  );
}

function RefreshIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.356v4.992" />
    </svg>
  );
}

function ClockIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#1a1f2e] border border-[#1f2937] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[#64748b] text-xs font-mono mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          <span className="text-[#94a3b8]">{entry.dataKey === 'trackers' ? 'Trackers' : 'Emails'}:</span>{' '}
          <span className="font-mono font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#111827] border border-[#1f2937] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-[#1f2937] rounded" />
              <div className="h-3 w-16 bg-[#1f2937] rounded" />
            </div>
            <div className="h-7 w-20 bg-[#1f2937] rounded mb-1" />
            <div className="h-3 w-12 bg-[#1f2937] rounded" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
        <div className="h-4 w-40 bg-[#1f2937] rounded mb-4" />
        <div className="h-36 bg-[#0a0e17] rounded flex items-end gap-[2px] px-2 pb-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-[#1f2937] rounded-t-sm"
              style={{ height: `${15 + Math.random() * 75}%` }}
            />
          ))}
        </div>
      </div>

      {/* Activity + Table skeletons */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
          <div className="h-4 w-28 bg-[#1f2937] rounded mb-3" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="w-2 h-2 bg-[#1f2937] rounded-full" />
              <div className="h-3 w-16 bg-[#1f2937] rounded" />
              <div className="h-3 flex-1 bg-[#1f2937] rounded" />
            </div>
          ))}
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
          <div className="h-4 w-36 bg-[#1f2937] rounded mb-3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="h-3 w-6 bg-[#1f2937] rounded" />
              <div className="h-3 w-24 bg-[#1f2937] rounded" />
              <div className="flex-1 h-2 bg-[#1f2937] rounded-full" />
              <div className="h-3 w-8 bg-[#1f2937] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ color }: { color: 'green' | 'red' | 'amber' }) {
  const colors = {
    green: 'bg-[#22c55e]',
    red: 'bg-[#ef4444]',
    amber: 'bg-[#f59e0b]',
  };
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[color]} shrink-0`} />
  );
}

// ── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: 'up' | 'down' | 'neutral';
  trendGood?: boolean; // is the trend direction good?
  suffix?: string;
}

function MetricCard({ icon, label, value, trend = 'neutral', trendGood = true, suffix }: MetricCardProps) {
  const trendColor = trend === 'neutral'
    ? 'text-[#64748b]'
    : trendGood
      ? 'text-[#22c55e]'
      : 'text-[#ef4444]';

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3 card-glow">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[#64748b]">
          {icon}
          <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
        </div>
        {trend !== 'neutral' && (
          <div className={`flex items-center gap-0.5 ${trendColor}`}>
            {trend === 'up' ? <ArrowUpIcon className="w-2.5 h-2.5" /> : <ArrowDownIcon className="w-2.5 h-2.5" />}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-mono tabular-nums text-[#e2e8f0]">
          {value.toLocaleString()}
        </span>
        {suffix && (
          <span className="text-xs text-[#64748b] font-mono">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-[#64748b]">No recent activity</p>
        <a
          href="/dashboard/aliases"
          className="text-xs text-[#6366f1] hover:text-[#818cf8] mt-1 inline-block transition-colors"
        >
          Create your first alias
        </a>
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto space-y-0 pr-1">
      {items.map((item) => {
        const dotColor: 'green' | 'red' | 'amber' =
          item.type === 'leak' ? 'red' : item.type === 'tracker' ? 'amber' : 'green';
        return (
          <div
            key={item.id}
            className="flex items-start gap-2 py-1.5 border-b border-[#1f2937]/50 last:border-0"
          >
            <div className="mt-1.5">
              <StatusDot color={dotColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#e2e8f0] leading-snug truncate">{item.description}</p>
            </div>
            <span className="text-[10px] font-mono text-[#64748b] shrink-0 mt-0.5">
              {item.timestamp}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Top Companies Table ──────────────────────────────────────────────────────

function CompaniesTable({ companies }: { companies: { company: string; count: number }[] }) {
  if (!companies.length) return null;
  const maxCount = companies[0]?.count || 1;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#64748b] font-medium pb-1.5 border-b border-[#1f2937]">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Company</span>
        <span className="w-20 text-right">Blocked</span>
      </div>
      {/* Rows */}
      {companies.slice(0, 8).map((c, i) => {
        const pct = maxCount > 0 ? (c.count / maxCount) * 100 : 0;
        return (
          <div
            key={c.company}
            className={`flex items-center gap-2 py-1.5 table-row-hover ${
              i % 2 === 0 ? 'bg-transparent' : 'bg-[#0d1117]/40'
            }`}
          >
            <span className="w-6 text-center text-[10px] font-mono text-[#64748b]">{i + 1}</span>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-xs text-[#94a3b8] truncate">{c.company}</span>
            </div>
            <div className="w-20 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-[#0a0e17] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6366f1] rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[#94a3b8] w-7 text-right tabular-nums">
                {c.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Quick Stat ───────────────────────────────────────────────────────────────

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 bg-[#111827] border border-[#1f2937] rounded-md">
      <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">{label}</span>
      <span className="text-sm font-mono tabular-nums text-[#e2e8f0] font-semibold">{value}</span>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-8 text-center max-w-sm w-full card-glow">
        <ShieldIcon className="w-10 h-10 text-[#64748b] mx-auto mb-4" />
        <p className="text-sm text-[#94a3b8] mb-4 leading-relaxed">
          Create your first alias to start monitoring trackers, detecting leaks, and building your privacy shield.
        </p>
        <a
          href="/dashboard/aliases"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-md transition-colors"
        >
          <EnvelopeIcon className="w-4 h-4" />
          Create First Alias
        </a>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '--';
  }
}

function buildActivityFeed(
  stats: TrackerStats | null,
  leaks: LeakEntry[],
  aliases: AliasEntry[]
): ActivityItem[] {
  const items: ActivityItem[] = [];

  // Add leak detections
  leaks
    .filter((l) => !l.dismissed)
    .forEach((l) => {
      items.push({
        id: `leak-${l.id}`,
        timestamp: l.created_at ? formatTimestamp(l.created_at) : '--',
        description: `Data leak detected`,
        type: 'leak',
      });
    });

  // Add recent alias creations
  aliases.slice(0, 5).forEach((a) => {
    items.push({
      id: `alias-${a.id}`,
      timestamp: a.created_at ? formatTimestamp(a.created_at) : '--',
      description: `Alias ${a.alias_email ? a.alias_email.split('@')[0] : a.id.slice(0, 8)} created`,
      type: 'alias',
    });
  });

  // Add tracker activity from daily trend (most recent days)
  if (stats?.daily_trend) {
    stats.daily_trend.slice(-5).reverse().forEach((d, i) => {
      if (d.trackers > 0) {
        items.push({
          id: `tracker-${d.date}-${i}`,
          timestamp: formatTimestamp(d.date),
          description: `${d.trackers} trackers blocked from ${d.emails} emails`,
          type: 'tracker',
        });
      }
    });
  }

  // Sort by most recent, take top 10
  return items.slice(0, 10);
}

function computeTrend(dailyTrend: { date: string; trackers: number }[]): 'up' | 'down' | 'neutral' {
  if (dailyTrend.length < 7) return 'neutral';
  const recent = dailyTrend.slice(-7);
  const older = dailyTrend.slice(-14, -7);
  if (older.length === 0) return 'neutral';
  const recentSum = recent.reduce((s, d) => s + d.trackers, 0);
  const olderSum = older.reduce((s, d) => s + d.trackers, 0);
  if (recentSum > olderSum * 1.1) return 'up';
  if (recentSum < olderSum * 0.9) return 'down';
  return 'neutral';
}

function formatChartDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<TrackerStats | null>(null);
  const [leaks, setLeaks] = useState<LeakEntry[]>([]);
  const [aliases, setAliases] = useState<AliasEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsRes, leaksRes, aliasesRes] = await Promise.all([
        apiFetch('/api/v2/trackers/stats'),
        apiFetch('/api/v2/leaks'),
        apiFetch('/api/v2/aliases'),
      ]);

      // Auth redirect
      if (statsRes.status === 401 || leaksRes.status === 401 || aliasesRes.status === 401) {
        router.push('/');
        return;
      }

      if (!statsRes.ok) {
        throw new Error('Failed to load tracker stats');
      }

      const statsData: TrackerStats = await statsRes.json();
      setStats(statsData);

      if (leaksRes.ok) {
        const leaksData: { leaks: LeakEntry[] } = await leaksRes.json();
        setLeaks(leaksData.leaks || []);
      }

      if (aliasesRes.ok) {
        const aliasesData: { aliases: AliasEntry[] } = await aliasesRes.json();
        setAliases(aliasesData.aliases || []);
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

  // Derived data
  const activeLeakCount = useMemo(() => leaks.filter((l) => !l.dismissed).length, [leaks]);
  const activeAliasCount = useMemo(() => aliases.filter((a) => a.status === 'active').length, [aliases]);
  const trackerTrend = useMemo(() => stats ? computeTrend(stats.daily_trend) : 'neutral', [stats]);
  const activityItems = useMemo(() => buildActivityFeed(stats, leaks, aliases), [stats, leaks, aliases]);

  const privacyScore = useMemo(() => {
    // Simple heuristic: base 50, +20 for having aliases, +15 for no leaks, +15 for blocking trackers
    let score = 50;
    if (activeAliasCount > 0) score += 20;
    if (activeLeakCount === 0) score += 15;
    if (stats && stats.total_trackers_blocked > 0) score += 15;
    return Math.min(score, 100);
  }, [activeAliasCount, activeLeakCount, stats]);

  const emailsToday = useMemo(() => {
    if (!stats?.daily_trend?.length) return 0;
    const today = stats.daily_trend[stats.daily_trend.length - 1];
    return today?.emails || 0;
  }, [stats]);

  const chartData = useMemo(() => {
    if (!stats?.daily_trend) return [];
    return stats.daily_trend.map((d) => ({
      ...d,
      label: formatChartDate(d.date),
    }));
  }, [stats]);

  // ── Loading ──

  if (loading) {
    return <LoadingSkeleton />;
  }

  // ── Empty State ──

  const isEmpty = !stats || (stats.emails_processed === 0 && activeAliasCount === 0);

  if (isEmpty && !error) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="bg-[#111827] border border-red-900/40 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        <EmptyState />
      </div>
    );
  }

  // ── Main Dashboard ──

  return (
    <div className="space-y-3">
      {/* Error banner */}
      {error && (
        <div className="bg-[#111827] border border-red-900/40 rounded-lg px-3 py-2 flex items-center gap-2">
          <ExclamationIcon className="w-4 h-4 text-[#ef4444] shrink-0" />
          <p className="text-xs text-red-400 flex-1">{error}</p>
          <button
            onClick={fetchData}
            className="text-xs text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Section: Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot color={activeLeakCount > 0 ? 'red' : 'green'} />
          <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">
            {activeLeakCount > 0 ? 'Alerts Active' : 'Systems Nominal'}
          </span>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1 text-[10px] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          aria-label="Refresh data"
        >
          <RefreshIcon className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Section: 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<EyeSlashIcon className="w-3.5 h-3.5" />}
          label="Trackers Blocked"
          value={stats?.total_trackers_blocked || 0}
          trend={trackerTrend}
          trendGood={trackerTrend === 'up'}
        />
        <MetricCard
          icon={<ExclamationIcon className="w-3.5 h-3.5" />}
          label="Leaks Detected"
          value={activeLeakCount}
          trend={activeLeakCount > 0 ? 'up' : 'neutral'}
          trendGood={false}
        />
        <MetricCard
          icon={<EnvelopeIcon className="w-3.5 h-3.5" />}
          label="Active Aliases"
          value={activeAliasCount}
          trend={activeAliasCount > 0 ? 'up' : 'neutral'}
          trendGood={true}
        />
        <MetricCard
          icon={<ShieldIcon className="w-3.5 h-3.5" />}
          label="Privacy Score"
          value={privacyScore}
          suffix="/100"
          trend={privacyScore >= 75 ? 'up' : privacyScore >= 50 ? 'neutral' : 'down'}
          trendGood={privacyScore >= 75}
        />
      </div>

      {/* Leak alert banner */}
      {activeLeakCount > 0 && (
        <button
          onClick={() => router.push('/dashboard/leaks')}
          className="w-full bg-[#111827] border border-red-900/40 rounded-lg px-3 py-2 flex items-center gap-2 hover:border-red-700/50 transition-colors text-left"
        >
          <StatusDot color="red" />
          <span className="text-xs text-red-400 font-medium flex-1">
            {activeLeakCount} active leak{activeLeakCount !== 1 ? 's' : ''} -- your data may have been shared
          </span>
          <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Section: Tracker Chart */}
      {chartData.length > 0 && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3 card-glow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <ChartIcon className="w-3.5 h-3.5 text-[#64748b]" />
              <h2 className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">
                Tracker Activity -- 30D
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-[2px] bg-[#6366f1] rounded-full" />
                <span className="text-[9px] text-[#64748b]">Trackers</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-[2px] bg-[#22c55e] rounded-full" />
                <span className="text-[9px] text-[#64748b]">Emails</span>
              </div>
            </div>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#1f2937' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: '#1f2937', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="trackers"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: '#6366f1', stroke: '#0a0e17', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="emails"
                  stroke="#22c55e"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="3 3"
                  activeDot={{ r: 3, fill: '#22c55e', stroke: '#0a0e17', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Section: Activity Feed */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3 card-glow">
        <div className="flex items-center gap-1.5 mb-2">
          <ClockIcon className="w-3.5 h-3.5 text-[#64748b]" />
          <h2 className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">
            Recent Activity
          </h2>
        </div>
        <ActivityFeed items={activityItems} />
      </div>

      {/* Section: Top Tracking Companies */}
      {stats && stats.top_tracker_companies.length > 0 && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3 card-glow">
          <div className="flex items-center gap-1.5 mb-2">
            <EyeSlashIcon className="w-3.5 h-3.5 text-[#64748b]" />
            <h2 className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">
              Top Tracking Companies
            </h2>
          </div>
          <CompaniesTable companies={stats.top_tracker_companies} />
        </div>
      )}

      {/* Section: Quick Stats Row */}
      <div className="grid grid-cols-2 gap-2">
        <QuickStat
          label="Emails today"
          value={emailsToday.toString()}
        />
        <QuickStat
          label="Links cleaned"
          value={(stats?.total_links_cleaned || 0).toLocaleString()}
        />
      </div>

      {/* Navigation grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { href: '/dashboard/aliases', label: 'Aliases', icon: <EnvelopeIcon className="w-4 h-4" /> },
          { href: '/dashboard/leaks', label: 'Leaks', icon: <ExclamationIcon className="w-4 h-4" />, alert: activeLeakCount > 0 },
          { href: '/dashboard/honeypots', label: 'Traps', icon: <EyeSlashIcon className="w-4 h-4" /> },
          { href: '/dashboard/gdpr', label: 'GDPR', icon: <ShieldIcon className="w-4 h-4" /> },
          { href: '/dashboard/scores', label: 'Scores', icon: <ChartIcon className="w-4 h-4" /> },
          { href: '/dashboard/autopilot', label: 'Scan', icon: <RefreshIcon className="w-4 h-4" /> },
          { href: '/dashboard/nuke', label: 'Nuke', icon: <ExclamationIcon className="w-4 h-4" /> },
          { href: '/dashboard/export', label: 'Export', icon: <ShieldIcon className="w-4 h-4" /> },
        ].map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className="relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-md bg-[#111827] border border-[#1f2937] hover:border-[#374151] transition-colors text-[#94a3b8] hover:text-[#e2e8f0]"
          >
            {item.alert && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse-dot" />
            )}
            {item.icon}
            <span className="text-[9px] uppercase tracking-wider font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
