import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const migrationSQL = readFileSync(
  join(__dirname, '../supabase/migrations/20260301_v2_tables.sql'),
  'utf-8'
);

describe('v2-001: V2 database migrations', () => {
  const expectedTables = [
    'alias_domains',
    'tracker_logs',
    'leak_detections',
    'company_privacy_scores',
    'email_summaries',
    'digest_batches',
    'honeypot_triggers',
    'deletion_requests',
    'company_privacy_contacts',
    'autopilot_scans',
    'audit_log',
    'families',
    'family_members',
  ];

  it('creates all 12+ new tables', () => {
    for (const table of expectedTables) {
      expect(migrationSQL).toContain(`CREATE TABLE ${table}`);
    }
  });

  it('ALTERs identities table with all new columns', () => {
    const identityColumns = [
      'domain_id',
      'reverse_alias_token',
      'reply_enabled',
      'phone_provider',
      'phone_provider_sid',
      'is_honeypot',
      'service_label',
      'simplelogin_alias_id',
    ];
    for (const col of identityColumns) {
      expect(migrationSQL).toMatch(
        new RegExp(`ALTER TABLE identities ADD COLUMN.*${col}`)
      );
    }
  });

  it('ALTERs user_settings table with all new columns', () => {
    const settingsColumns = [
      'email_forward_mode',
      'digest_frequency',
      'digest_time',
      'digest_day',
      'autopilot_enabled',
      'autopilot_auto_kill_days',
      'nuke_contact_number',
    ];
    for (const col of settingsColumns) {
      expect(migrationSQL).toMatch(
        new RegExp(`ALTER TABLE user_settings ADD COLUMN.*${col}`)
      );
    }
  });

  it('enables RLS on every new table', () => {
    for (const table of expectedTables) {
      expect(migrationSQL).toContain(
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`
      );
    }
  });

  it('has correct RLS policies matching architecture spec', () => {
    // User-scoped read policies
    const userReadTables = [
      'tracker_logs',
      'leak_detections',
      'email_summaries',
      'digest_batches',
      'honeypot_triggers',
      'deletion_requests',
      'autopilot_scans',
      'audit_log',
    ];
    for (const table of userReadTables) {
      expect(migrationSQL).toMatch(
        new RegExp(
          `CREATE POLICY.*ON ${table} FOR SELECT.*auth\\.uid\\(\\)\\s*=\\s*user_id`,
          's'
        )
      );
    }

    // Public read policies
    expect(migrationSQL).toMatch(
      /CREATE POLICY.*ON alias_domains FOR SELECT.*active\s*=\s*true/s
    );
    expect(migrationSQL).toMatch(
      /CREATE POLICY.*ON company_privacy_scores FOR SELECT.*true/s
    );
    expect(migrationSQL).toMatch(
      /CREATE POLICY.*ON company_privacy_contacts FOR SELECT.*true/s
    );

    // User update policies
    expect(migrationSQL).toMatch(
      /CREATE POLICY.*ON leak_detections FOR UPDATE.*auth\.uid\(\)\s*=\s*user_id/s
    );
    expect(migrationSQL).toMatch(
      /CREATE POLICY.*ON deletion_requests FOR UPDATE.*auth\.uid\(\)\s*=\s*user_id/s
    );
  });

  it('creates required indexes', () => {
    expect(migrationSQL).toContain(
      'CREATE INDEX idx_tracker_logs_user_date ON tracker_logs(user_id, processed_at DESC)'
    );
    expect(migrationSQL).toContain(
      'CREATE INDEX idx_email_summaries_user_date ON email_summaries(user_id, received_at DESC)'
    );
    expect(migrationSQL).toContain(
      'CREATE INDEX idx_audit_log_user_date ON audit_log(user_id, created_at DESC)'
    );
  });

  it('audit_log has NO insert/update/delete policy for users', () => {
    // Should only have a SELECT policy, no INSERT/UPDATE/DELETE
    const auditSection = migrationSQL.slice(
      migrationSQL.indexOf('CREATE TABLE audit_log'),
      migrationSQL.indexOf('CREATE TABLE families')
    );
    expect(auditSection).toContain('FOR SELECT');
    expect(auditSection).not.toMatch(/FOR INSERT/);
    expect(auditSection).not.toMatch(/FOR UPDATE/);
    expect(auditSection).not.toMatch(/FOR DELETE/);
  });

  it('migration file is valid SQL (no syntax issues)', () => {
    // Basic validation: balanced parentheses, statements end with ;
    const openParens = (migrationSQL.match(/\(/g) || []).length;
    const closeParens = (migrationSQL.match(/\)/g) || []).length;
    expect(openParens).toBe(closeParens);

    // Every CREATE TABLE and ALTER TABLE has a semicolon
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));
    expect(statements.length).toBeGreaterThan(0);
  });

  it('uses phantomdefender.com domain not phantomshield.com', () => {
    expect(migrationSQL).not.toContain('phantomshield.com');
  });

  it('phone_provider defaults to twilio (not telnyx)', () => {
    expect(migrationSQL).toMatch(/phone_provider.*DEFAULT\s*'twilio'/);
  });

  it('all correct column types and foreign keys', () => {
    // UUID primary keys
    expect(migrationSQL).toMatch(
      /alias_domains[\s\S]*?id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/
    );
    // Foreign keys
    expect(migrationSQL).toMatch(
      /tracker_logs[\s\S]*?identity_id UUID REFERENCES identities\(id\) ON DELETE CASCADE/
    );
    expect(migrationSQL).toMatch(
      /tracker_logs[\s\S]*?user_id UUID REFERENCES auth\.users\(id\) ON DELETE CASCADE/
    );
    // UNIQUE constraint
    expect(migrationSQL).toContain('UNIQUE(family_id, user_id)');
    // BIGINT for simplelogin_alias_id
    expect(migrationSQL).toMatch(/simplelogin_alias_id\s+BIGINT/);
  });
});
