import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTrackerStats, TrackerStats } from '../hooks/useTrackerStats';

interface TrackerDashboardProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
}

function CompanyBar({ company, count, maxCount }: { company: string; count: number; maxCount: number }) {
  const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <View style={styles.companyRow} accessibilityLabel={`${company}: ${count} trackers`}>
      <Text style={styles.companyName}>{company}</Text>
      <View style={styles.barContainer}>
        <View style={[styles.bar, { width: `${width}%` }]} />
      </View>
      <Text style={styles.companyCount}>{count}</Text>
    </View>
  );
}

function Sparkline({ data }: { data: { date: string; trackers: number }[] }) {
  const max = Math.max(...data.map((d) => d.trackers), 1);
  return (
    <View style={styles.sparkline} accessibilityLabel="30-day tracker trend">
      {data.map((d, i) => (
        <View
          key={d.date}
          style={[
            styles.sparkBar,
            { height: Math.max((d.trackers / max) * 60, 2) },
          ]}
        />
      ))}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🛡️</Text>
      <Text style={styles.emptyText}>
        No trackers blocked yet. As you use your aliases, we'll show you who's tracking you.
      </Text>
    </View>
  );
}

export function TrackerDashboard({ apiBaseUrl, getToken }: TrackerDashboardProps) {
  const { stats, loading, error, fetchStats } = useTrackerStats(apiBaseUrl, getToken);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.skeleton} />
        <View style={[styles.skeleton, { width: '60%' }]} />
        <View style={[styles.skeleton, { width: '80%' }]} />
      </View>
    );
  }

  if (!stats || stats.emails_processed === 0) {
    return <EmptyState />;
  }

  const topCompanies = stats.top_tracker_companies.slice(0, 5);
  const maxCompanyCount = topCompanies.length > 0 ? topCompanies[0].count : 1;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#A5B4FC" />
      }
    >
      {/* Big number */}
      <View style={styles.heroSection}>
        <Text
          style={styles.heroNumber}
          accessibilityLabel={`${stats.total_trackers_blocked} total trackers blocked`}
        >
          {stats.total_trackers_blocked.toLocaleString()}
        </Text>
        <Text style={styles.heroLabel}>Trackers Blocked (30 days)</Text>
        <View style={styles.subStats}>
          <View style={styles.subStat}>
            <Text style={styles.subStatNumber}>{stats.total_links_cleaned}</Text>
            <Text style={styles.subStatLabel}>Links Cleaned</Text>
          </View>
          <View style={styles.subStat}>
            <Text style={styles.subStatNumber}>{stats.emails_processed}</Text>
            <Text style={styles.subStatLabel}>Emails Scanned</Text>
          </View>
        </View>
      </View>

      {/* 30-day trend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          30-Day Trend
        </Text>
        <Sparkline data={stats.daily_trend} />
      </View>

      {/* Top tracker companies */}
      {topCompanies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Top Tracker Companies
          </Text>
          {topCompanies.map((c) => (
            <CompanyBar
              key={c.company}
              company={c.company}
              count={c.count}
              maxCount={maxCompanyCount}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0D23',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0D23',
    padding: 20,
  },
  skeleton: {
    height: 24,
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
  },
  heroSection: {
    alignItems: 'center',
    padding: 32,
  },
  heroNumber: {
    fontSize: 64,
    fontWeight: '800',
    color: '#E0E7FF',
  },
  heroLabel: {
    fontSize: 16,
    color: '#A5B4FC',
    marginTop: 4,
  },
  subStats: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 32,
  },
  subStat: {
    alignItems: 'center',
  },
  subStatNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#C7D2FE',
  },
  subStatLabel: {
    fontSize: 12,
    color: '#818CF8',
    marginTop: 2,
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E0E7FF',
    marginBottom: 12,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 2,
  },
  sparkBar: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 2,
    minHeight: 2,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  companyName: {
    width: 100,
    fontSize: 14,
    color: '#C7D2FE',
  },
  barContainer: {
    flex: 1,
    height: 12,
    backgroundColor: '#1E1B4B',
    borderRadius: 6,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 6,
  },
  companyCount: {
    width: 40,
    textAlign: 'right',
    fontSize: 14,
    color: '#A5B4FC',
  },
  emptyState: {
    flex: 1,
    backgroundColor: '#0F0D23',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#A5B4FC',
    textAlign: 'center',
    lineHeight: 24,
  },
});
