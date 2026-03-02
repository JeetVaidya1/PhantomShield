import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(
  join(__dirname, '../mobile/screens/ExportSettings.tsx'),
  'utf-8'
);

describe('v2-037: Export UI in settings', () => {
  it('export section with two buttons (JSON + CSV)', () => {
    expect(source).toContain('Export as JSON');
    expect(source).toContain('Export as CSV');
    expect(source).toContain('Export My Data');
  });

  it('biometric prompt before export', () => {
    expect(source).toContain('getBiometricToken');
    expect(source).toContain('Biometric verification failed');
  });

  it('loading indicator during generation', () => {
    expect(source).toContain('ActivityIndicator');
    expect(source).toContain('loading');
  });

  it('file shared via React Native Share API', () => {
    expect(source).toContain('Share.share');
  });

  it('error handling with retry', () => {
    expect(source).toContain('Export Failed');
    expect(source).toContain('try again');
  });

  it('x-biometric-token header sent', () => {
    expect(source).toContain('x-biometric-token');
  });

  it('calls export API with format parameter', () => {
    expect(source).toContain('format=');
    expect(source).toContain('/api/v2/export');
  });
});
