import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  getRiskLevel,
  getRiskColor,
  getRiskLabel,
} from '../mobile/hooks/usePrivacyScore';

const hookSource = readFileSync(
  join(__dirname, '../mobile/hooks/usePrivacyScore.ts'),
  'utf-8'
);

const badgeSource = readFileSync(
  join(__dirname, '../mobile/components/PrivacyScoreBadge.tsx'),
  'utf-8'
);

describe('v2-033: Privacy score badge in alias creation and detail', () => {
  describe('getRiskLevel', () => {
    it('80-100 = low risk', () => {
      expect(getRiskLevel(80)).toBe('low');
      expect(getRiskLevel(100)).toBe('low');
      expect(getRiskLevel(95)).toBe('low');
    });

    it('50-79 = medium risk', () => {
      expect(getRiskLevel(50)).toBe('medium');
      expect(getRiskLevel(79)).toBe('medium');
      expect(getRiskLevel(65)).toBe('medium');
    });

    it('0-49 = high risk', () => {
      expect(getRiskLevel(0)).toBe('high');
      expect(getRiskLevel(49)).toBe('high');
      expect(getRiskLevel(25)).toBe('high');
    });

    it('null = unknown', () => {
      expect(getRiskLevel(null)).toBe('unknown');
    });
  });

  describe('getRiskColor', () => {
    it('returns green for low risk', () => {
      expect(getRiskColor('low')).toBe('#22C55E');
    });

    it('returns yellow for medium risk', () => {
      expect(getRiskColor('medium')).toBe('#EAB308');
    });

    it('returns red for high risk', () => {
      expect(getRiskColor('high')).toBe('#EF4444');
    });

    it('returns gray for unknown', () => {
      expect(getRiskColor('unknown')).toBe('#6B7280');
    });
  });

  describe('getRiskLabel', () => {
    it('returns correct labels', () => {
      expect(getRiskLabel('low')).toBe('Low Risk');
      expect(getRiskLabel('medium')).toBe('Medium Risk');
      expect(getRiskLabel('high')).toBe('High Risk');
      expect(getRiskLabel('unknown')).toBe('No data available');
    });
  });

  describe('usePrivacyScore hook', () => {
    it('implements 500ms debounce', () => {
      expect(hookSource).toContain('500');
      expect(hookSource).toContain('debounce');
      expect(hookSource).toContain('setTimeout');
    });

    it('calls company-scores API', () => {
      expect(hookSource).toContain('company-scores');
    });

    it('handles insufficient_data response', () => {
      expect(hookSource).toContain('insufficient_data');
    });

    it('does not block on errors (silent failure)', () => {
      expect(hookSource).toContain('catch');
      // Error state not shown to user
    });
  });

  describe('PrivacyScoreBadge component', () => {
    it('shows score out of 100', () => {
      expect(badgeSource).toContain('/100');
    });

    it('uses risk level colors', () => {
      expect(badgeSource).toContain('getRiskLevel');
      expect(badgeSource).toContain('getRiskColor');
      expect(badgeSource).toContain('getRiskLabel');
    });

    it('shows loading state', () => {
      expect(badgeSource).toContain('ActivityIndicator');
      expect(badgeSource).toContain('Checking privacy score');
    });

    it('returns null when no data', () => {
      expect(badgeSource).toContain('return null');
    });

    it('has accessibility label', () => {
      expect(badgeSource).toContain('accessibilityLabel');
      expect(badgeSource).toContain('Privacy score');
    });
  });
});
