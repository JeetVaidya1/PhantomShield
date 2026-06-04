import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, '../mobile/screens/FamilyDashboard.tsx'), 'utf-8');

describe('v2-039: Family dashboard mobile screen', () => {
  it('is gated behind an active family-plan subscription', () => {
    expect(source).toContain('hasFamilyPlan');
    expect(source).toContain('return null');
  });

  it('shows member list with role and joined date', () => {
    expect(source).toContain('item.role');
    expect(source).toContain('item.joined_at');
  });

  it('shows an aggregate stats card', () => {
    expect(source).toContain('blocked {stats.total_trackers_blocked} trackers');
    expect(source).toContain('total_aliases');
    expect(source).toContain('total_leaks');
  });

  it('has an invite flow that posts to the family invite API', () => {
    expect(source).toContain('/api/v2/family/invite');
    expect(source).toContain('inviteEmail');
  });

  it('lets the owner remove members with confirmation', () => {
    expect(source).toContain('Remove member?');
    expect(source).toContain('/api/v2/family/members/');
  });

  it('exposes parental controls for child accounts', () => {
    expect(source).toContain('Parental controls');
    expect(source).toContain('phone_disabled');
    expect(source).toContain("item.role === 'child'");
  });

  it('renders read-only for non-owners (no manage/invite buttons)', () => {
    expect(source).toContain('isOwner ?');
    expect(source).toContain('Only the family owner can invite');
  });
});
