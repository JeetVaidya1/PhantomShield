'use client';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState, useCallback } from 'react';

// --- Stats Context (shared across all pages via layout) ---
interface DashboardStats {
  activeAliases: number;
  trackersBlocked: number;
  leaksDetected: number;
  privacyScore: number;
}

// --- Navigation Items ---
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: OverviewIcon },
  { href: '/dashboard/aliases', label: 'Aliases', icon: AliasIcon },
  { href: '/dashboard/leaks', label: 'Leaks', icon: LeakIcon },
  { href: '/dashboard/honeypots', label: 'Honeypots', icon: HoneypotIcon },
  { href: '/dashboard/gdpr', label: 'GDPR', icon: GdprIcon },
  { href: '/dashboard/scores', label: 'Scores', icon: ScoreIcon },
  { href: '/dashboard/phone', label: 'Phone', icon: PhoneIcon },
  { href: '/dashboard/autopilot', label: 'Autopilot', icon: AutopilotIcon },
  { href: '/dashboard/nuke', label: 'Nuke', icon: NukeIcon, danger: true },
  { href: '/dashboard/export', label: 'Export', icon: ExportIcon },
  { href: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
];

const MOBILE_NAV = [
  { href: '/dashboard', label: 'Overview', icon: OverviewIcon },
  { href: '/dashboard/aliases', label: 'Aliases', icon: AliasIcon },
  { href: '/dashboard/leaks', label: 'Leaks', icon: LeakIcon },
  { href: '/dashboard/gdpr', label: 'GDPR', icon: GdprIcon },
  { href: '/dashboard/settings', label: 'More', icon: MoreIcon },
];

// --- Icons (SVG, no emoji) ---
function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}
function AliasIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}
function LeakIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
function HoneypotIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}
function GdprIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
function ScoreIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
function PhoneIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}
function AutopilotIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function NukeIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#ef4444]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
    </svg>
  );
}
function ExportIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.204-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[#6366f1]' : 'text-[#64748b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

// --- Top Stats Bar ---
function TopStatsBar({ stats }: { stats: DashboardStats }) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto py-2 px-1 no-scrollbar">
      <StatPill label="ALIASES ACTIVE" value={stats.activeAliases} color="text-[#22c55e]" />
      <div className="w-px h-4 bg-[#1f2937] shrink-0" />
      <StatPill label="TRACKERS BLOCKED" value={stats.trackersBlocked} color="text-[#6366f1]" />
      <div className="w-px h-4 bg-[#1f2937] shrink-0" />
      <StatPill label="LEAKS DETECTED" value={stats.leaksDetected} color={stats.leaksDetected > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />
      <div className="w-px h-4 bg-[#1f2937] shrink-0" />
      <StatPill label="PRIVACY SCORE" value={`${stats.privacyScore}/100`} color={stats.privacyScore >= 70 ? 'text-[#22c55e]' : stats.privacyScore >= 40 ? 'text-[#f59e0b]' : 'text-[#ef4444]'} />
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[10px] font-semibold tracking-wider text-[#64748b] uppercase whitespace-nowrap">{label}</span>
      <span className={`text-sm font-bold font-mono tabular-nums ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  );
}

// --- Dashboard Shell ---
function DashboardShell({ children }: { children: ReactNode }) {
  const { username, planTier, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({ activeAliases: 0, trackersBlocked: 0, leaksDetected: 0, privacyScore: 78 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [aliasRes, statsRes, leaksRes] = await Promise.all([
        apiFetch('/api/v2/aliases'),
        apiFetch('/api/v2/trackers/stats'),
        apiFetch('/api/v2/leaks'),
      ]);
      const aliases = aliasRes.ok ? await aliasRes.json() : { aliases: [] };
      const trackers = statsRes.ok ? await statsRes.json() : { total_trackers_blocked: 0 };
      const leaks = leaksRes.ok ? await leaksRes.json() : { leaks: [] };

      setStats({
        activeAliases: (aliases.aliases || []).filter((a: { status: string }) => a.status === 'active').length,
        trackersBlocked: trackers.total_trackers_blocked || 0,
        leaksDetected: (leaks.leaks || []).filter((l: { dismissed: boolean }) => !l.dismissed).length,
        privacyScore: 78,
      });
    } catch {
      // Silent fail — stats bar shows defaults
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-[#1f2937] bg-[#0d1117] fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-[#1f2937]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6366f1] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-[#e2e8f0]">Phantom</span>
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#6366f1]/10 text-[#6366f1]'
                    : item.danger
                    ? 'text-[#64748b] hover:text-[#ef4444] hover:bg-[#ef4444]/5'
                    : 'text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1f2937]/50'
                }`}
              >
                <Icon active={active} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-[#1f2937] p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#1f2937] flex items-center justify-center text-xs font-bold text-[#94a3b8] uppercase">
              {username?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#e2e8f0] truncate">{username}</p>
              <span className={`text-[10px] font-bold tracking-wider uppercase ${planTier === 'pro' ? 'text-[#6366f1]' : 'text-[#f59e0b]'}`}>
                {planTier === 'pro' ? 'PRO' : 'FREE'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#64748b] hover:text-[#e2e8f0] transition-colors"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-[#0d1117] border-r border-[#1f2937] flex flex-col">
            <div className="h-14 flex items-center justify-between px-5 border-b border-[#1f2937]">
              <span className="text-sm font-bold text-[#e2e8f0]">Phantom</span>
              <button onClick={() => setSidebarOpen(false)} className="text-[#64748b] hover:text-[#e2e8f0]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#6366f1]/10 text-[#6366f1]'
                        : item.danger
                        ? 'text-[#64748b] hover:text-[#ef4444] hover:bg-[#ef4444]/5'
                        : 'text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1f2937]/50'
                    }`}
                  >
                    <Icon active={active} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-[#0a0e17]/95 backdrop-blur-sm border-b border-[#1f2937]">
          <div className="flex items-center h-14 px-4 lg:px-6 gap-4">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-[#64748b] hover:text-[#e2e8f0] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Stats Bar */}
            <div className="flex-1 overflow-hidden">
              <TopStatsBar stats={stats} />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Notification bell */}
              <button className="relative text-[#64748b] hover:text-[#e2e8f0] transition-colors">
                <BellIcon />
                {stats.leaksDetected > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] text-[9px] font-bold text-white flex items-center justify-center">
                    {stats.leaksDetected}
                  </span>
                )}
              </button>

              {/* Plan badge (mobile) */}
              <Link
                href={planTier === 'pro' ? '/dashboard/settings' : '/dashboard/upgrade'}
                className={`lg:hidden text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                  planTier === 'pro'
                    ? 'bg-[#6366f1]/15 text-[#6366f1]'
                    : 'bg-[#f59e0b]/15 text-[#f59e0b]'
                }`}
              >
                {planTier === 'pro' ? 'PRO' : 'FREE'}
              </Link>

              {/* Mobile user initial */}
              <button
                onClick={handleLogout}
                className="lg:hidden w-7 h-7 rounded-full bg-[#1f2937] flex items-center justify-center text-xs font-bold text-[#94a3b8] uppercase"
                title="Logout"
              >
                {username?.charAt(0) || '?'}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0d1117]/95 backdrop-blur-sm border-t border-[#1f2937] pb-safe">
        <div className="flex justify-around items-center h-14">
          {MOBILE_NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href === '/dashboard/settings' ? '#' : item.href}
                onClick={(e) => {
                  if (item.label === 'More') {
                    e.preventDefault();
                    setSidebarOpen(true);
                  }
                }}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                  active ? 'text-[#6366f1]' : 'text-[#64748b]'
                }`}
              >
                <Icon active={active} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
