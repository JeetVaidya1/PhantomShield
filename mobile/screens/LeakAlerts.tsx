import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';

interface LeakDetection {
  id: string;
  identity_id: string;
  expected_sender: string;
  actual_sender_domain: string;
  actual_sender_email: string;
  detected_at: string;
  dismissed: boolean;
}

interface LeakAlertsProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  onNavigateGDPR: (companyDomain: string) => void;
  onKillAlias: (identityId: string) => void;
}

export function LeakAlerts({
  apiBaseUrl,
  getToken,
  onNavigateGDPR,
  onKillAlias,
}: LeakAlertsProps) {
  const [leaks, setLeaks] = useState<LeakDetection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaks = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBaseUrl}/api/v2/leaks`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaks(data.leaks || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getToken]);

  useEffect(() => {
    fetchLeaks();
  }, [fetchLeaks]);

  const handleDismiss = useCallback(
    async (id: string) => {
      const token = await getToken();
      await fetch(`${apiBaseUrl}/api/v2/leaks/${id}/dismiss`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}` },
      });
      setLeaks((prev) => prev.filter((l) => l.id !== id));
    },
    [apiBaseUrl, getToken]
  );

  const handleKillAlias = useCallback(
    (identityId: string, serviceName: string) => {
      Alert.alert(
        'Kill Alias',
        `Are you sure you want to permanently deactivate the alias for ${serviceName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Kill Alias',
            style: 'destructive',
            onPress: () => onKillAlias(identityId),
          },
        ]
      );
    },
    [onKillAlias]
  );

  const renderItem = ({ item }: { item: LeakDetection }) => {
    const date = new Date(item.detected_at).toLocaleDateString();
    return (
      <View style={styles.card} accessibilityLabel={`Leak alert: ${item.expected_sender} alias received email from ${item.actual_sender_domain}`}>
        <View style={styles.cardHeader}>
          <Text style={styles.serviceName}>{item.expected_sender}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <Text style={styles.senderDomain}>
          Unexpected sender: {item.actual_sender_domain}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => handleDismiss(item.id)}
            accessibilityLabel="Dismiss alert"
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gdprButton}
            onPress={() => onNavigateGDPR(item.actual_sender_domain)}
            accessibilityLabel="Send deletion request"
            accessibilityRole="button"
          >
            <Text style={styles.gdprText}>Send Deletion Request</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.killButton}
            onPress={() =>
              handleKillAlias(item.identity_id, item.expected_sender)
            }
            accessibilityLabel="Kill alias"
            accessibilityRole="button"
          >
            <Text style={styles.killText}>Kill Alias</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!loading && leaks.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>✅</Text>
        <Text style={styles.emptyText}>
          No suspicious activity detected. Your aliases are clean.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={leaks}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchLeaks} tintColor="#A5B4FC" />
      }
    />
  );
}

export function getLeakBadgeCount(leaks: LeakDetection[]): number {
  return leaks.filter((l) => !l.dismissed).length;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0D23',
  },
  card: {
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E0E7FF',
  },
  date: {
    fontSize: 13,
    color: '#818CF8',
  },
  senderDomain: {
    fontSize: 14,
    color: '#FCA5A5',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  dismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#312E81',
  },
  dismissText: {
    color: '#A5B4FC',
    fontSize: 13,
  },
  gdprButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E3A8A',
  },
  gdprText: {
    color: '#93C5FD',
    fontSize: 13,
  },
  killButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7F1D1D',
  },
  killText: {
    color: '#FCA5A5',
    fontSize: 13,
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
