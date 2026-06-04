import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  StyleSheet,
} from 'react-native';

interface StaleIdentity {
  identity_id: string;
  service_label: string;
  reason: string;
  last_activity?: string | null;
}

interface AutopilotReviewProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  stale: StaleIdentity[];
  totalIdentities: number;
}

export function AutopilotReview({ apiBaseUrl, getToken, stale, totalIdentities }: AutopilotReviewProps) {
  const [pending, setPending] = useState<StaleIdentity[]>(stale);
  const [resolved, setResolved] = useState(0);

  const post = useCallback(
    async (path: string, identityId: string) => {
      const token = await getToken();
      const res = await fetch(`${apiBaseUrl}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ identity_ids: [identityId] }),
      });
      if (!res.ok) throw new Error('request failed');
    },
    [apiBaseUrl, getToken]
  );

  const resolve = useCallback(
    (identityId: string) => {
      setPending((prev) => prev.filter((s) => s.identity_id !== identityId));
      setResolved((r) => r + 1);
    },
    []
  );

  const handleKill = useCallback(
    (identityId: string) => {
      Alert.alert('Kill identity?', 'This permanently deactivates the alias.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kill',
          style: 'destructive',
          onPress: async () => {
            try {
              await post('/api/v2/autopilot/kill', identityId);
              resolve(identityId);
            } catch {
              Alert.alert('Kill failed', 'Please try again.');
            }
          },
        },
      ]);
    },
    [post, resolve]
  );

  const handleKeep = useCallback(
    async (identityId: string) => {
      try {
        await post('/api/v2/autopilot/keep', identityId);
        resolve(identityId);
      } catch {
        Alert.alert('Keep failed', 'Please try again.');
      }
    },
    [post, resolve]
  );

  // Footprint reduction = killed/kept out of total identities.
  const footprintReduction = useMemo(() => {
    if (totalIdentities === 0) return 0;
    return Math.round((resolved / totalIdentities) * 100);
  }, [resolved, totalIdentities]);

  if (pending.length === 0) {
    return (
      <View style={styles.done}>
        <Text style={styles.doneTitle}>All reviewed 🎉</Text>
        <Text style={styles.doneText}>Reduced footprint by {footprintReduction}%</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={pending}
      keyExtractor={(item) => item.identity_id}
      ListHeaderComponent={<Text style={styles.title}>{pending.length} stale identities</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.service}>{item.service_label}</Text>
          <Text style={styles.reason}>{item.reason}</Text>
          {item.last_activity ? <Text style={styles.activity}>Last activity: {item.last_activity}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.keep]} onPress={() => handleKeep(item.identity_id)}>
              <Text style={styles.buttonText}>Keep</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.kill]} onPress={() => handleKill(item.identity_id)}>
              <Text style={styles.buttonText}>Kill</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: '#e5e5e5', padding: 16 },
  card: { marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  service: { fontSize: 15, fontWeight: '600', color: '#e5e5e5' },
  reason: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  activity: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  actions: { flexDirection: 'row', marginTop: 10 },
  button: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', marginRight: 8 },
  keep: { backgroundColor: '#0c2a30' },
  kill: { backgroundColor: '#3a1212', marginRight: 0 },
  buttonText: { color: '#e5e5e5', fontWeight: '600' },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  doneTitle: { fontSize: 20, fontWeight: '700', color: '#e5e5e5' },
  doneText: { fontSize: 15, color: '#22d3ee', marginTop: 8 },
});
