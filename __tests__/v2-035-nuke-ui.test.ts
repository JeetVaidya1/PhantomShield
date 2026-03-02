import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(
  join(__dirname, '../mobile/screens/EmergencyNuke.tsx'),
  'utf-8'
);

describe('v2-035: Emergency nuke mobile UI', () => {
  it('red-styled emergency section', () => {
    expect(source).toContain('emergencySection');
    expect(source).toContain('#EF4444');
    expect(source).toContain('#DC2626');
  });

  it('NUKE EVERYTHING button', () => {
    expect(source).toContain('NUKE EVERYTHING');
  });

  it('biometric authentication required', () => {
    expect(source).toContain('getBiometricToken');
    expect(source).toContain('Biometric verification failed');
  });

  it('confirmation dialog lists counts', () => {
    expect(source).toContain('activeAliases');
    expect(source).toContain('activePhones');
    expect(source).toContain('gdprEligible');
  });

  it('I\'m safe toggle for emergency contact', () => {
    expect(source).toContain('sendSafeMessage');
    expect(source).toContain("I'm safe");
    expect(source).toContain('nukeContactNumber');
  });

  it('requires typing NUKE to confirm', () => {
    expect(source).toContain("confirmText !== 'NUKE'");
    expect(source).toContain('EXECUTE NUKE');
  });

  it('loading screen during nuke', () => {
    expect(source).toContain('ActivityIndicator');
    expect(source).toContain('Executing emergency nuke');
  });

  it('success screen shows results and recovery date', () => {
    expect(source).toContain('Nuke Complete');
    expect(source).toContain('Account recoverable until');
    expect(source).toContain('recovery_deadline');
  });

  it('calls onNukeComplete to reset app', () => {
    expect(source).toContain('onNukeComplete');
  });
});
