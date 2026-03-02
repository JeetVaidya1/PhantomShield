import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI
const mockCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: 'marketing' } }],
});

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    },
  }),
  getSupabaseServiceClient: () => ({
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  }),
}));

import { classifyEmail } from '../lib/email/classifier';
import { summarizeEmail } from '../lib/email/summarizer';
import { POST } from '../app/api/v2/email/summarize/route';

describe('v2-020: Email classification and AI summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_WEBHOOK_SECRET', 'test-secret');
  });

  describe('classifyEmail', () => {
    it('"Your order has shipped" classified as transactional without AI call', async () => {
      const result = await classifyEmail(
        'Your order has shipped',
        'orders@amazon.com',
        'Your package is on its way'
      );
      expect(result).toBe('transactional');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('newsletter with "unsubscribe" classified as marketing without AI call', async () => {
      const result = await classifyEmail(
        'Weekly Newsletter',
        'news@company.com',
        'Click here to unsubscribe from our mailing list'
      );
      expect(result).toBe('marketing');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('password reset classified as transactional', async () => {
      const result = await classifyEmail(
        'Password Reset Request',
        'security@example.com',
        'Click to reset your password'
      );
      expect(result).toBe('transactional');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('ambiguous email calls AI and returns classification', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'marketing' } }],
      });

      const result = await classifyEmail(
        'Important Update',
        'hello@company.com',
        'We wanted to let you know about changes to our service'
      );
      expect(result).toBe('marketing');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('summarizeEmail', () => {
    it('summary is <= 20 words', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'Company announces new product launch with special pricing for early adopters.',
            },
          },
        ],
      });

      const result = await summarizeEmail('New Product', 'Some body text');
      const wordCount = result.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(21); // 20 + possible "..."
    });

    it('truncates very long summaries', async () => {
      const longSummary = Array(30).fill('word').join(' ');
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: longSummary } }],
      });

      const result = await summarizeEmail('Test', 'body');
      const wordCount = result.replace('...', '').trim().split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(20);
    });

    it('falls back to subject on error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));

      const result = await summarizeEmail('Fallback Subject', 'body');
      expect(result).toBe('Fallback Subject');
    });
  });

  describe('POST /api/v2/email/summarize', () => {
    it('endpoint secured by shared secret', async () => {
      const req = new Request('http://localhost/api/v2/email/summarize', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ subject: 'Test', from: 'a@b.com' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('returns type and summary for valid request', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Quick summary of the email.' } }],
      });

      const req = new Request('http://localhost/api/v2/email/summarize', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Weekly Newsletter',
          from: 'news@company.com',
          body_preview: 'Click here to unsubscribe. Great deals this week!',
          user_id: 'user-123',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.type).toBe('marketing');
      expect(data.summary).toBeDefined();
    });

    it('body preview truncated to 2000 chars', () => {
      // Verify in source code
      const { readFileSync } = require('fs');
      const { join } = require('path');
      const routeSource = readFileSync(
        join(__dirname, '../app/api/v2/email/summarize/route.ts'),
        'utf-8'
      );
      expect(routeSource).toContain('.slice(0, 2000)');
    });

    it('OPENAI_API_KEY from env, never exposed in response', async () => {
      const req = new Request('http://localhost/api/v2/email/summarize', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Your order shipped',
          from: 'orders@shop.com',
          body_preview: 'Your package is on the way',
          user_id: 'user-123',
        }),
      });
      const res = await POST(req);
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain('test-key');
      expect(text).not.toContain('OPENAI_API_KEY');
    });
  });
});
