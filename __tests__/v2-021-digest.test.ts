import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: { getUser: vi.fn() } }),
  getSupabaseServiceClient: () => ({ from: () => ({}) }),
}));

import {
  isDigestDue,
  formatDigestHtml,
  parseDigestHour,
  processDigestForUser,
  type DigestSettings,
  type EmailSummaryRow,
} from '../lib/email/digest';
import { POST as digestCron } from '../app/api/cron/digest/route';

function settings(over: Partial<DigestSettings> = {}): DigestSettings {
  return {
    user_id: 'u1',
    email_forward_mode: 'digest',
    digest_frequency: 'daily',
    digest_time: '08:00',
    digest_day: 1,
    ...over,
  };
}

// A chainable Supabase mock that resolves selects/updates to configured data.
function mockSupabase(opts: {
  pending: EmailSummaryRow[];
  onInsert?: (row: unknown) => void;
  onUpdate?: (patch: unknown, ids: unknown) => void;
}) {
  return {
    from(table: string) {
      if (table === 'email_summaries') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({ eq: () => Promise.resolve({ data: opts.pending, error: null }) }),
              }),
            }),
          }),
          update: (patch: unknown) => ({
            in: (_col: string, ids: unknown) => {
              opts.onUpdate?.(patch, ids);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'digest_batches') {
        return {
          insert: (row: unknown) => {
            opts.onInsert?.(row);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'batch-1' }, error: null }) }) };
          },
        };
      }
      return {};
    },
  };
}

describe('v2-021: Digest batching engine', () => {
  afterEach(() => vi.unstubAllEnvs());

  describe('POST /api/cron/digest', () => {
    it('rejects requests without a valid CRON_SECRET', async () => {
      vi.stubEnv('CRON_SECRET', 'the-secret');
      const res = await digestCron(
        new Request('http://localhost/api/cron/digest', {
          method: 'POST',
          headers: { authorization: 'Bearer wrong' },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe('parseDigestHour / isDigestDue', () => {
    it('parses HH:MM and HH:MM:SS', () => {
      expect(parseDigestHour('08:00')).toBe(8);
      expect(parseDigestHour('23:30:00')).toBe(23);
      expect(parseDigestHour(null)).toBeNull();
      expect(parseDigestHour('99:00')).toBeNull();
    });

    it('is due when the UTC hour matches (daily)', () => {
      const now = new Date(Date.UTC(2026, 0, 5, 8, 5)); // 08:05 UTC
      expect(isDigestDue(settings(), now)).toBe(true);
    });

    it('is not due at a different hour', () => {
      const now = new Date(Date.UTC(2026, 0, 5, 9, 0));
      expect(isDigestDue(settings(), now)).toBe(false);
    });

    it('weekly mode only fires on the configured weekday', () => {
      const monday = new Date(Date.UTC(2026, 0, 5, 8, 0)); // 2026-01-05 is a Monday (day 1)
      const tuesday = new Date(Date.UTC(2026, 0, 6, 8, 0));
      const weekly = settings({ digest_frequency: 'weekly', digest_day: 1 });
      expect(isDigestDue(weekly, monday)).toBe(true);
      expect(isDigestDue(weekly, tuesday)).toBe(false);
    });

    it('non-digest modes are never due', () => {
      expect(isDigestDue(settings({ email_forward_mode: 'full' }), new Date(Date.UTC(2026, 0, 5, 8, 0)))).toBe(false);
    });
  });

  describe('formatDigestHtml', () => {
    it('renders one entry per summary and escapes HTML', () => {
      const html = formatDigestHtml([
        { id: '1', email_from: 'a@x.com', email_subject: '<b>Sale</b>', summary: '50% off' },
        { id: '2', email_from: 'b@y.com', email_subject: 'News', summary: null },
      ]);
      expect(html).toContain('2 messages');
      expect(html).toContain('&lt;b&gt;Sale&lt;/b&gt;');
      expect(html).toContain('a@x.com');
    });
  });

  describe('processDigestForUser', () => {
    it('compiles a digest with 5 summaries, creates a batch, marks forwarded', async () => {
      const pending: EmailSummaryRow[] = Array.from({ length: 5 }, (_, i) => ({
        id: `e${i}`,
        email_from: `s${i}@x.com`,
        email_subject: `Subj ${i}`,
        summary: `Sum ${i}`,
      }));
      const onInsert = vi.fn();
      const onUpdate = vi.fn();
      const supabase = mockSupabase({ pending, onInsert, onUpdate });

      const result = await processDigestForUser(supabase as never, settings(), new Date(Date.UTC(2026, 0, 5, 8, 0)));

      expect(result).toEqual({ sent: true, emailCount: 5 });
      expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', email_count: 5, sent: true }));
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ forwarded: true, digest_batch_id: 'batch-1' }),
        ['e0', 'e1', 'e2', 'e3', 'e4']
      );
    });

    it('skips a user with no pending emails (no empty digest)', async () => {
      const onInsert = vi.fn();
      const supabase = mockSupabase({ pending: [], onInsert });
      const result = await processDigestForUser(supabase as never, settings(), new Date());
      expect(result).toEqual({ sent: false, emailCount: 0 });
      expect(onInsert).not.toHaveBeenCalled();
    });
  });
});
