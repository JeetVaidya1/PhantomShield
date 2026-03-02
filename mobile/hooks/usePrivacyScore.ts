import { useState, useCallback, useRef } from 'react';

export interface PrivacyScore {
  company_domain: string;
  company_name: string;
  privacy_score: number;
  leak_rate: number;
  total_aliases: number;
  last_computed_at: string;
  status?: 'insufficient_data';
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';

export function getRiskLevel(score: number | null): RiskLevel {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 80) return 'low';
  if (score >= 50) return 'medium';
  return 'high';
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return '#22C55E';
    case 'medium':
      return '#EAB308';
    case 'high':
      return '#EF4444';
    default:
      return '#6B7280';
  }
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'Low Risk';
    case 'medium':
      return 'Medium Risk';
    case 'high':
      return 'High Risk';
    default:
      return 'No data available';
  }
}

export function usePrivacyScore(apiBaseUrl: string) {
  const [score, setScore] = useState<PrivacyScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookupScore = useCallback(
    (serviceName: string) => {
      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      const trimmed = serviceName.trim().toLowerCase();
      if (!trimmed || trimmed.length < 2) {
        setScore(null);
        setError(null);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(
            `${apiBaseUrl}/api/v2/company-scores/${encodeURIComponent(trimmed)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'insufficient_data') {
              setScore(null);
            } else {
              setScore(data);
            }
          } else {
            setScore(null);
          }
        } catch {
          setScore(null);
          setError(null); // Don't show errors for score lookup
        } finally {
          setLoading(false);
        }
      }, 500); // 500ms debounce
    },
    [apiBaseUrl]
  );

  const reset = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setScore(null);
    setLoading(false);
    setError(null);
  }, []);

  return { score, loading, error, lookupScore, reset };
}
