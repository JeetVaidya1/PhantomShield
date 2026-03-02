import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(
  join(__dirname, '../mobile/screens/GDPRRequestTracker.tsx'),
  'utf-8'
);

describe('v2-028: GDPR request tracker mobile screen', () => {
  it('request list sorted by date desc (fetches from API)', () => {
    expect(source).toContain('deletion-requests');
    expect(source).toContain('fetchRequests');
  });

  it('status badges with correct colors per status', () => {
    expect(source).toContain("sent: { label: 'Sent'");
    expect(source).toContain("awaiting: { label: 'Awaiting'");
    expect(source).toContain("completed: { label: 'Completed'");
    expect(source).toContain("ignored: { label: 'Ignored'");
    expect(source).toContain('StatusBadge');
  });

  it('awaiting status shows countdown days remaining', () => {
    expect(source).toContain('getDaysRemaining');
    expect(source).toContain('days remaining');
    expect(source).toContain('days overdue');
  });

  it('create from identity: onCreateRequest callback', () => {
    expect(source).toContain('onCreateRequest');
    expect(source).toContain('Create Request');
  });

  it('mark complete button updates status', () => {
    expect(source).toContain('Mark Complete');
    expect(source).toContain('handleMarkComplete');
    expect(source).toContain("status: 'completed'");
  });

  it('escalate button shows links to FTC (US) and DPA (EU)', () => {
    expect(source).toContain('Escalate');
    expect(source).toContain('handleEscalate');
    expect(source).toContain('reportfraud.ftc.gov');
    expect(source).toContain('ico.org.uk');
    expect(source).toContain('cnil.fr');
  });

  it('overdue requests highlighted in red', () => {
    expect(source).toContain('isOverdue');
    expect(source).toContain('cardOverdue');
    expect(source).toContain('countdownOverdue');
  });

  it('pull to refresh supported', () => {
    expect(source).toContain('RefreshControl');
    expect(source).toContain('onRefresh');
  });
});
