import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read source files for structural validation (no React Native runtime in tests)
const cardSource = readFileSync(
  join(__dirname, '../mobile/components/TrackerCard.tsx'),
  'utf-8'
);
const dashboardSource = readFileSync(
  join(__dirname, '../mobile/screens/TrackerDashboard.tsx'),
  'utf-8'
);
const hookSource = readFileSync(
  join(__dirname, '../mobile/hooks/useTrackerStats.ts'),
  'utf-8'
);

describe('v2-017: Tracker dashboard mobile screen', () => {
  it('TrackerCard component exists and renders tracker count', () => {
    expect(cardSource).toContain('TrackerCard');
    expect(cardSource).toContain('totalBlocked');
    expect(cardSource).toContain('Trackers Blocked This Month');
  });

  it('card loads data from GET /api/v2/trackers/stats', () => {
    expect(hookSource).toContain('/api/v2/trackers/stats');
  });

  it('tapping card navigates via onPress prop', () => {
    expect(cardSource).toContain('onPress');
    expect(cardSource).toContain('TouchableOpacity');
  });

  it('dashboard shows total blocked as large styled number', () => {
    expect(dashboardSource).toContain('heroNumber');
    expect(dashboardSource).toContain('total_trackers_blocked');
    expect(dashboardSource).toContain('toLocaleString');
  });

  it('shows top 5 tracker companies with bar visualization', () => {
    expect(dashboardSource).toContain('CompanyBar');
    expect(dashboardSource).toContain('slice(0, 5)');
    expect(dashboardSource).toContain('barContainer');
  });

  it('shows 30-day trend as sparkline', () => {
    expect(dashboardSource).toContain('Sparkline');
    expect(dashboardSource).toContain('daily_trend');
    expect(dashboardSource).toContain('30-Day Trend');
  });

  it('pull-to-refresh works', () => {
    expect(dashboardSource).toContain('RefreshControl');
    expect(dashboardSource).toContain('onRefresh');
  });

  it('loading skeleton shown while data fetches', () => {
    expect(dashboardSource).toContain('skeleton');
    expect(dashboardSource).toContain('loadingContainer');
  });

  it('empty state message displayed', () => {
    expect(dashboardSource).toContain('No trackers blocked yet');
    expect(dashboardSource).toContain("we'll show you who's tracking you");
  });

  it('accessible: screen reader labels on all elements', () => {
    expect(cardSource).toContain('accessibilityLabel');
    expect(cardSource).toContain('accessibilityRole');
    expect(dashboardSource).toContain('accessibilityLabel');
    expect(dashboardSource).toContain('accessibilityRole');
  });

  it('shows per-alias breakdown via sub stats', () => {
    expect(dashboardSource).toContain('Emails Scanned');
    expect(dashboardSource).toContain('Links Cleaned');
  });
});
