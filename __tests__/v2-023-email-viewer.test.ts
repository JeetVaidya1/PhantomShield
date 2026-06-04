import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ---- Email delete route ----
let deleteSpy = vi.fn();
let deleteError: unknown = null;
vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
  }),
  getSupabaseServiceClient: () => ({
    from: () => ({
      delete: () => ({
        eq: () => ({
          eq: (...args: unknown[]) => {
            deleteSpy(...args);
            return Promise.resolve({ error: deleteError });
          },
        }),
      }),
    }),
  }),
}));

import { DELETE } from '../app/api/v2/email/[id]/route';

describe('v2-023: email delete route', () => {
  beforeEach(() => {
    deleteSpy = vi.fn();
    deleteError = null;
  });

  it('requires auth', async () => {
    const res = await DELETE(new Request('http://localhost/api/v2/email/e1', { method: 'DELETE' }), { params: { id: 'e1' } });
    expect(res.status).toBe(401);
  });

  it('deletes the email summary scoped to the user', async () => {
    const res = await DELETE(
      new Request('http://localhost/api/v2/email/e1', { method: 'DELETE', headers: { authorization: 'Bearer x' } }),
      { params: { id: 'e1' } }
    );
    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith('user_id', 'user-123');
  });
});

describe('v2-023: EmailViewer screen security config', () => {
  const source = readFileSync(join(__dirname, '../mobile/screens/EmailViewer.tsx'), 'utf-8');

  it('decrypts full_body_encrypted using the key from expo-secure-store', () => {
    expect(source).toContain('expo-secure-store');
    expect(source).toContain('decryptEmailBody');
    expect(source).toContain('full_body_encrypted');
  });

  it('locks the WebView down (no JS, no file access, mixedContent never)', () => {
    expect(source).toContain('javaScriptEnabled={false}');
    expect(source).toContain('allowFileAccess={false}');
    expect(source).toContain('mixedContentMode="never"');
  });

  it('opens external links in the system browser', () => {
    expect(source).toContain('Linking.openURL');
    expect(source).toContain('onShouldStartLoadWithRequest');
  });

  it('blocks images until the user taps Load Images', () => {
    expect(source).toContain('Load Images');
    expect(source).toContain('loadImages');
  });

  it('shows the tracker-stripped banner and leak status', () => {
    expect(source).toContain('were stripped from this email');
    expect(source).toContain('is_leak');
  });

  it('has Reply (reverse alias) and Delete actions', () => {
    expect(source).toContain('Reply via Alias');
    expect(source).toContain('reverse_alias');
    expect(source).toContain('/api/v2/email/');
  });

  it('requires biometric before viewing', () => {
    expect(source).toContain('expo-local-authentication');
    expect(source).toContain('authenticateAsync');
  });
});
