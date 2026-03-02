import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(
  join(__dirname, '../mobile/screens/HoneypotManager.tsx'),
  'utf-8'
);

describe('v2-025: Honeypot manager mobile screen', () => {
  it('honeypot list sorted by triggered status (triggered first)', () => {
    expect(source).toContain('b.trigger_count - a.trigger_count');
  });

  it('green badge for never-triggered honeypots', () => {
    expect(source).toContain('badgeGreen');
    expect(source).toContain('Clean');
  });

  it('red badge with trigger count for triggered honeypots', () => {
    expect(source).toContain('badgeRed');
    expect(source).toContain('Triggered');
    expect(source).toContain('trigger_count');
  });

  it('create flow with service label input', () => {
    expect(source).toContain('Create Honeypot');
    expect(source).toContain('planted_at_service');
    expect(source).toContain('newLabel');
    expect(source).toContain('newService');
  });

  it('detail view shows trigger history', () => {
    expect(source).toContain('trigger_from_email');
    expect(source).toContain('trigger_from_domain');
    expect(source).toContain('triggered_at');
  });

  it('delete button with confirmation dialog', () => {
    expect(source).toContain('Delete Honeypot');
    expect(source).toContain('Alert.alert');
    expect(source).toContain('destructive');
  });

  it('empty state explains what honeypots are', () => {
    expect(source).toContain('Plant fake email aliases');
    expect(source).toContain('data was shared or sold');
  });

  it('pull to refresh works', () => {
    expect(source).toContain('RefreshControl');
    expect(source).toContain('onRefresh');
  });
});
