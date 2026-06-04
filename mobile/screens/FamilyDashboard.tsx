import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  FlatList,
  StyleSheet,
} from 'react-native';

interface FamilyMember {
  id: string;
  name: string;
  role: 'owner' | 'member' | 'child';
  joined_at: string;
  max_aliases?: number | null;
  phone_disabled?: boolean;
}

interface FamilyStats {
  total_trackers_blocked: number;
  total_aliases: number;
  total_leaks: number;
  member_count: number;
}

interface FamilyDashboardProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  /** Active family-plan subscription (from RevenueCat). The section is hidden without it. */
  hasFamilyPlan: boolean;
  isOwner: boolean;
  members: FamilyMember[];
  stats: FamilyStats;
}

export function FamilyDashboard({
  apiBaseUrl,
  getToken,
  hasFamilyPlan,
  isOwner,
  members,
  stats,
}: FamilyDashboardProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [list, setList] = useState(members);

  const sendInvite = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${apiBaseUrl}/api/v2/family/invite`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (!res.ok) throw new Error('invite failed');
      Alert.alert('Invite sent', `An invite was sent to ${inviteEmail}.`);
      setInviteEmail('');
    } catch {
      Alert.alert('Invite failed', 'Please check the email and try again.');
    }
  }, [apiBaseUrl, getToken, inviteEmail]);

  const removeMember = useCallback(
    (memberId: string) => {
      Alert.alert('Remove member?', 'They will lose access to the family plan.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await fetch(`${apiBaseUrl}/api/v2/family/members/${memberId}`, {
                method: 'DELETE',
                headers: { authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error('remove failed');
              setList((prev) => prev.filter((m) => m.id !== memberId));
            } catch {
              Alert.alert('Remove failed', 'Please try again.');
            }
          },
        },
      ]);
    },
    [apiBaseUrl, getToken]
  );

  // Family section is only visible with an active family-plan subscription.
  if (!hasFamilyPlan) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>
          Your family blocked {stats.total_trackers_blocked} trackers this month
        </Text>
        <Text style={styles.statsLine}>
          {stats.total_aliases} aliases · {stats.total_leaks} leaks caught · {stats.member_count} members
        </Text>
      </View>

      <FlatList
        data={list}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Members</Text>}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.name}</Text>
              <Text style={styles.memberMeta}>
                {item.role} · joined {item.joined_at}
              </Text>
            </View>

            {/* Parental controls for child accounts (owner only). */}
            {isOwner && item.role === 'child' && (
              <View style={styles.parental}>
                <Text style={styles.parentalLabel}>Disable phone</Text>
                <Switch value={Boolean(item.phone_disabled)} onValueChange={() => undefined} />
              </View>
            )}

            {isOwner && item.role !== 'owner' && (
              <TouchableOpacity style={styles.removeButton} onPress={() => removeMember(item.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Invite + manage controls are owner-only; non-owners get a read-only view. */}
      {isOwner ? (
        <View style={styles.inviteRow}>
          <TextInput
            style={styles.input}
            placeholder="member@email.com"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            keyboardType="email-address"
            value={inviteEmail}
            onChangeText={setInviteEmail}
          />
          <TouchableOpacity style={styles.inviteButton} onPress={sendInvite}>
            <Text style={styles.inviteButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.readOnly}>Only the family owner can invite or manage members.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  statsCard: { backgroundColor: '#0c2a30', borderRadius: 12, padding: 16, marginBottom: 16 },
  statsTitle: { fontSize: 16, fontWeight: '700', color: '#e5e5e5' },
  statsLine: { fontSize: 13, color: '#9ca3af', marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e5e5e5', marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, color: '#e5e5e5', fontWeight: '600' },
  memberMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  parental: { alignItems: 'center', marginRight: 12 },
  parentalLabel: { fontSize: 11, color: '#9ca3af' },
  removeButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#3a1212' },
  removeText: { color: '#e5e5e5', fontSize: 13 },
  inviteRow: { flexDirection: 'row', marginTop: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 12, color: '#e5e5e5', marginRight: 8 },
  inviteButton: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8, backgroundColor: '#0c2a30' },
  inviteButtonText: { color: '#22d3ee', fontWeight: '600' },
  readOnly: { color: '#9ca3af', fontSize: 13, marginTop: 16 },
});
