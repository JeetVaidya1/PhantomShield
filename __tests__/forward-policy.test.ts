import { describe, it, expect } from 'vitest';
import { shouldForward } from '../lib/email/forward-policy';

describe('shouldForward', () => {
  it('defaults to transactional-only when no policy is set', () => {
    expect(shouldForward({ type: 'transactional' })).toBe(true);
    expect(shouldForward({ type: 'marketing' })).toBe(false);
  });

  it('honors transactional_only', () => {
    expect(shouldForward({ type: 'transactional', mutePolicy: 'transactional_only' })).toBe(true);
    expect(shouldForward({ type: 'marketing', mutePolicy: 'transactional_only' })).toBe(false);
  });

  it('forwards everything under "all"', () => {
    expect(shouldForward({ type: 'marketing', mutePolicy: 'all' })).toBe(true);
    expect(shouldForward({ type: 'transactional', mutePolicy: 'all' })).toBe(true);
  });

  it('forwards nothing under "silent"', () => {
    expect(shouldForward({ type: 'transactional', mutePolicy: 'silent' })).toBe(false);
    expect(shouldForward({ type: 'marketing', mutePolicy: 'silent' })).toBe(false);
  });

  it('never forwards a retired relationship, regardless of policy', () => {
    expect(shouldForward({ type: 'transactional', mutePolicy: 'all', retired: true })).toBe(false);
  });
});
