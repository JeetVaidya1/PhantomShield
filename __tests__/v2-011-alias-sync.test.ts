import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createAlias,
  deactivateAlias,
  __setPoolForTests,
} from '../lib/email/alias-sync';

interface MockPool {
  query: ReturnType<typeof vi.fn>;
}

function makePool(query: ReturnType<typeof vi.fn>): MockPool {
  return { query };
}

describe('v2-011: SimpleLogin database bridge', () => {
  beforeEach(() => {
    vi.stubEnv('SIMPLELOGIN_SERVICE_USER_ID', '7');
    vi.useRealTimers();
  });

  afterEach(() => {
    __setPoolForTests(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('createAlias', () => {
    it('resolves an existing mailbox and inserts an alias with correct user_id/mailbox_id', async () => {
      const query = vi
        .fn()
        // resolveMailboxId: SELECT existing mailbox -> found id 42
        .mockResolvedValueOnce({ rows: [{ id: 42 }] })
        // INSERT alias -> returns alias id 1001
        .mockResolvedValueOnce({ rows: [{ id: 1001 }] });
      __setPoolForTests(makePool(query) as never);

      const result = await createAlias('user-abc', 'rand@phantomdefender.com', 'me@gmail.com');

      expect(result.simpleloginAliasId).toBe(1001);
      expect(result.mailboxId).toBe(42);

      // Second query is the alias insert; verify columns/params.
      const insertCall = query.mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO alias/i);
      expect(insertCall[1]).toEqual([
        'rand@phantomdefender.com',
        7, // service user id
        42, // mailbox id
        'pd:user-abc',
      ]);
    });

    it('creates a mailbox when none exists', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // mailbox SELECT: none
        .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // mailbox INSERT
        .mockResolvedValueOnce({ rows: [{ id: 2002 }] }); // alias INSERT
      __setPoolForTests(makePool(query) as never);

      const result = await createAlias('user-x', 'a@phantomdefender.com', 'real@proton.me');

      expect(query.mock.calls[1][0]).toMatch(/INSERT INTO mailbox/i);
      expect(result.mailboxId).toBe(99);
      expect(result.simpleloginAliasId).toBe(2002);
    });
  });

  describe('deactivateAlias', () => {
    it('sets enabled=false on the alias record', async () => {
      const query = vi.fn().mockResolvedValue({ rows: [] });
      __setPoolForTests(makePool(query) as never);

      await deactivateAlias(1001);

      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE alias SET enabled = false/i),
        [1001]
      );
    });
  });

  describe('retry logic', () => {
    it('retries 3 times then throws (without leaking credentials)', async () => {
      vi.useFakeTimers();
      const query = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1:5432'));
      __setPoolForTests(makePool(query) as never);

      const promise = deactivateAlias(5).catch((e: Error) => e);
      await vi.runAllTimersAsync();
      const error = await promise;

      expect(query).toHaveBeenCalledTimes(3);
      expect((error as Error).message).toMatch(/failed after 3 attempts/i);
      // Credentials / DB URI must not appear in the surfaced error.
      expect((error as Error).message).not.toMatch(/SIMPLELOGIN_DB_URI/);
    });
  });
});
