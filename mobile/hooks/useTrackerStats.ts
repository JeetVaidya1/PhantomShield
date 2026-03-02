import { useState, useCallback } from 'react';

export interface TrackerStats {
  total_trackers_blocked: number;
  total_links_cleaned: number;
  emails_processed: number;
  top_tracker_companies: { company: string; count: number }[];
  daily_trend: { date: string; trackers: number; emails: number }[];
}

export function useTrackerStats(apiBaseUrl: string, getToken: () => Promise<string>) {
  const [stats, setStats] = useState<TrackerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBaseUrl}/api/v2/trackers/stats`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tracker stats');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getToken]);

  return { stats, loading, error, fetchStats };
}
