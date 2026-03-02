import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';

interface DeletionRequest {
  id: string;
  identity_id: string;
  company_name: string;
  company_email: string;
  request_type: string;
  status: 'sent' | 'awaiting' | 'completed' | 'ignored' | 'escalated';
  sent_at: string;
  response_deadline: string;
  completed_at: string | null;
}

interface GDPRRequestTrackerProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  onCreateRequest: (identityId?: string, companyName?: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  sent: { label: 'Sent', color: '#93C5FD', bg: '#1E3A8A' },
  awaiting: { label: 'Awaiting', color: '#FCD34D', bg: '#78350F' },
  completed: { label: 'Completed', color: '#6EE7B7', bg: '#065F46' },
  ignored: { label: 'Ignored', color: '#FCA5A5', bg: '#7F1D1D' },
  escalated: { label: 'Escalated', color: '#F9A8D4', bg: '#831843' },
};

const ESCALATION_LINKS = {
  ftc: 'https://reportfraud.ftc.gov/',
  ico: 'https://ico.org.uk/make-a-complaint/',
  cnil: 'https://www.cnil.fr/en/plaintes',
};

function getDaysRemaining(responseDeadline: string): number {
  const now = new Date();
  const deadline = new Date(responseDeadline);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdue(request: DeletionRequest): boolean {
  if (request.status === 'completed' || request.status === 'escalated') return false;
  return getDaysRemaining(request.response_deadline) < 0;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.sent;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]} accessibilityLabel={`Status: ${config.label}`}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

export function GDPRRequestTracker({
  apiBaseUrl,
  getToken,
  onCreateRequest,
}: GDPRRequestTrackerProps) {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBaseUrl}/api/v2/deletion-requests`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getToken]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleMarkComplete = useCallback(
    async (id: string) => {
      try {
        const token = await getToken();
        const res = await fetch(`${apiBaseUrl}/api/v2/deletion-requests/${id}`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: 'completed' }),
        });
        if (res.ok) {
          setRequests((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: 'completed' as const, completed_at: new Date().toISOString() } : r))
          );
        }
      } catch {
        // Silently fail
      }
    },
    [apiBaseUrl, getToken]
  );

  const handleEscalate = useCallback(() => {
    Alert.alert('Escalate', 'Choose a regulatory body to file a complaint:', [
      {
        text: 'FTC (US)',
        onPress: () => Linking.openURL(ESCALATION_LINKS.ftc),
      },
      {
        text: 'ICO (UK)',
        onPress: () => Linking.openURL(ESCALATION_LINKS.ico),
      },
      {
        text: 'CNIL (EU/France)',
        onPress: () => Linking.openURL(ESCALATION_LINKS.cnil),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const renderItem = ({ item }: { item: DeletionRequest }) => {
    const daysRemaining = getDaysRemaining(item.response_deadline);
    const overdue = isOverdue(item);
    const sentDate = new Date(item.sent_at).toLocaleDateString();

    return (
      <View
        style={[styles.card, overdue && styles.cardOverdue]}
        accessibilityLabel={`Deletion request for ${item.company_name}, status: ${item.status}`}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.companyName}>{item.company_name}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.detail}>To: {item.company_email}</Text>
        <Text style={styles.detail}>Sent: {sentDate}</Text>
        <Text style={styles.detail}>
          Type: {item.request_type === 'ccpa_deletion' ? 'CCPA' : 'GDPR'}
        </Text>

        {(item.status === 'sent' || item.status === 'awaiting') && (
          <Text style={[styles.countdown, overdue && styles.countdownOverdue]}>
            {overdue
              ? `${Math.abs(daysRemaining)} days overdue`
              : `${daysRemaining} days remaining`}
          </Text>
        )}

        <View style={styles.actions}>
          {item.status !== 'completed' && item.status !== 'escalated' && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleMarkComplete(item.id)}
              accessibilityLabel="Mark as complete"
              accessibilityRole="button"
            >
              <Text style={styles.completeText}>Mark Complete</Text>
            </TouchableOpacity>
          )}
          {(item.status === 'ignored' || overdue) && (
            <TouchableOpacity
              style={styles.escalateButton}
              onPress={handleEscalate}
              accessibilityLabel="Escalate request"
              accessibilityRole="button"
            >
              <Text style={styles.escalateText}>Escalate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (!loading && requests.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>
          No deletion requests yet. Create one from any identity to exercise your
          privacy rights.
        </Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => onCreateRequest()}
          accessibilityLabel="Create deletion request"
          accessibilityRole="button"
        >
          <Text style={styles.createText}>Create Request</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchRequests} tintColor="#A5B4FC" />
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => onCreateRequest()}
        accessibilityLabel="New deletion request"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export function getOverdueCount(requests: DeletionRequest[]): number {
  return requests.filter(isOverdue).length;
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
    borderLeftColor: '#6366F1',
  },
  cardOverdue: {
    borderLeftColor: '#EF4444',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E0E7FF',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
    color: '#A5B4FC',
    marginBottom: 2,
  },
  countdown: {
    fontSize: 14,
    color: '#FCD34D',
    fontWeight: '600',
    marginTop: 8,
  },
  countdownOverdue: {
    color: '#EF4444',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  completeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#065F46',
  },
  completeText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '600',
  },
  escalateButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7F1D1D',
  },
  escalateText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
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
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#6366F1',
  },
  createText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
