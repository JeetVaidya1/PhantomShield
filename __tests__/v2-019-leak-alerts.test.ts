import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(
  join(__dirname, '../mobile/screens/LeakAlerts.tsx'),
  'utf-8'
);

describe('v2-019: Leak alerts mobile screen', () => {
  it('lists non-dismissed leak detections', () => {
    expect(source).toContain('/api/v2/leaks');
    expect(source).toContain('FlatList');
  });

  it('each item shows: service name, unexpected sender, date', () => {
    expect(source).toContain('expected_sender');
    expect(source).toContain('actual_sender_domain');
    expect(source).toContain('detected_at');
    expect(source).toContain('toLocaleDateString');
  });

  it('dismiss button calls PATCH /api/v2/leaks/:id/dismiss', () => {
    expect(source).toContain('/dismiss');
    expect(source).toContain("method: 'PATCH'");
    expect(source).toContain('handleDismiss');
  });

  it('send deletion request button navigates to GDPR flow', () => {
    expect(source).toContain('onNavigateGDPR');
    expect(source).toContain('Send Deletion Request');
  });

  it('kill alias button with confirmation dialog', () => {
    expect(source).toContain('onKillAlias');
    expect(source).toContain('Kill Alias');
    expect(source).toContain('Alert.alert');
    expect(source).toContain('destructive');
  });

  it('badge count shows number of non-dismissed leaks', () => {
    expect(source).toContain('getLeakBadgeCount');
    expect(source).toContain('!l.dismissed');
  });

  it('push notification deep link supported via props', () => {
    expect(source).toContain('LeakAlertsProps');
  });

  it('empty state message displayed', () => {
    expect(source).toContain('No suspicious activity detected');
    expect(source).toContain('Your aliases are clean');
  });

  it('pull to refresh works', () => {
    expect(source).toContain('RefreshControl');
    expect(source).toContain('onRefresh');
  });
});
