import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  StyleSheet,
  Modal,
} from 'react-native';

interface Honeypot {
  id: string;
  label: string;
  service_label: string;
  trigger_count: number;
  last_trigger: string | null;
  triggers: { triggered_at: string; trigger_from_email: string; trigger_from_domain: string }[];
}

interface HoneypotManagerProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
}

export function HoneypotManager({ apiBaseUrl, getToken }: HoneypotManagerProps) {
  const [honeypots, setHoneypots] = useState<Honeypot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedHoneypot, setSelectedHoneypot] = useState<Honeypot | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newService, setNewService] = useState('');

  const fetchHoneypots = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBaseUrl}/api/v2/honeypots`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Sort: triggered first
        const sorted = (data.honeypots || []).sort(
          (a: Honeypot, b: Honeypot) => b.trigger_count - a.trigger_count
        );
        setHoneypots(sorted);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getToken]);

  useEffect(() => {
    fetchHoneypots();
  }, [fetchHoneypots]);

  const handleCreate = useCallback(async () => {
    if (!newLabel.trim() || !newService.trim()) return;
    try {
      const token = await getToken();
      const res = await fetch(`${apiBaseUrl}/api/v2/honeypots`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ label: newLabel, planted_at_service: newService }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewLabel('');
        setNewService('');
        fetchHoneypots();
      }
    } catch {
      Alert.alert('Error', 'Failed to create honeypot');
    }
  }, [newLabel, newService, apiBaseUrl, getToken, fetchHoneypots]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete Honeypot', 'Are you sure you want to delete this honeypot?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            await fetch(`${apiBaseUrl}/api/v2/honeypots/${id}`, {
              method: 'DELETE',
              headers: { authorization: `Bearer ${token}` },
            });
            fetchHoneypots();
          },
        },
      ]);
    },
    [apiBaseUrl, getToken, fetchHoneypots]
  );

  const renderItem = ({ item }: { item: Honeypot }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelectedHoneypot(item)}
      accessibilityLabel={`Honeypot ${item.label}: ${item.trigger_count > 0 ? `Triggered ${item.trigger_count} times` : 'Clean'}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.honeypotLabel}>{item.label}</Text>
        {item.trigger_count > 0 ? (
          <View style={[styles.badge, styles.badgeRed]}>
            <Text style={styles.badgeText}>Triggered ({item.trigger_count} times)</Text>
          </View>
        ) : (
          <View style={[styles.badge, styles.badgeGreen]}>
            <Text style={styles.badgeText}>Clean</Text>
          </View>
        )}
      </View>
      <Text style={styles.serviceLabel}>Planted at: {item.service_label}</Text>
    </TouchableOpacity>
  );

  if (!loading && honeypots.length === 0 && !showCreate) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🍯</Text>
        <Text style={styles.emptyTitle}>Honeypot Aliases</Text>
        <Text style={styles.emptyText}>
          Plant fake email aliases at services you don't trust. If the alias receives
          email, you'll know your data was shared or sold.
        </Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.createButtonText}>Create Your First Honeypot</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={honeypots}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchHoneypots} tintColor="#A5B4FC" />
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
            <Text style={styles.addButtonText}>+ New Honeypot</Text>
          </TouchableOpacity>
        }
      />

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Honeypot</Text>
            <TextInput
              style={styles.input}
              placeholder="Label (e.g., Trap for Dark Forum)"
              placeholderTextColor="#6B7280"
              value={newLabel}
              onChangeText={setNewLabel}
              accessibilityLabel="Honeypot label"
            />
            <TextInput
              style={styles.input}
              placeholder="Where you'll plant it"
              placeholderTextColor="#6B7280"
              value={newService}
              onChangeText={setNewService}
              accessibilityLabel="Service where honeypot will be planted"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleCreate}>
                <Text style={styles.confirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!selectedHoneypot} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedHoneypot?.label}</Text>
            <Text style={styles.detailService}>
              Planted at: {selectedHoneypot?.service_label}
            </Text>
            {selectedHoneypot?.triggers?.length ? (
              selectedHoneypot.triggers.map((t, i) => (
                <View key={i} style={styles.triggerRow}>
                  <Text style={styles.triggerDate}>
                    {new Date(t.triggered_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.triggerEmail}>{t.trigger_from_email}</Text>
                  <Text style={styles.triggerDomain}>{t.trigger_from_domain}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noTriggers}>No triggers yet</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  if (selectedHoneypot) handleDelete(selectedHoneypot.id);
                  setSelectedHoneypot(null);
                }}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedHoneypot(null)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0D23' },
  card: {
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  honeypotLabel: { fontSize: 16, fontWeight: '600', color: '#E0E7FF' },
  serviceLabel: { fontSize: 13, color: '#818CF8' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeGreen: { backgroundColor: '#065F46' },
  badgeRed: { backgroundColor: '#7F1D1D' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyState: {
    flex: 1,
    backgroundColor: '#0F0D23',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#E0E7FF', marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#A5B4FC', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  createButton: { backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  addButton: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#312E81',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addButtonText: { color: '#818CF8', fontSize: 16 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1E1B4B', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#E0E7FF', marginBottom: 16 },
  input: {
    backgroundColor: '#312E81',
    borderRadius: 8,
    padding: 14,
    color: '#E0E7FF',
    fontSize: 16,
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  cancelText: { color: '#818CF8', fontSize: 16 },
  confirmButton: { backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteText: { color: '#EF4444', fontSize: 16 },
  detailService: { color: '#A5B4FC', fontSize: 14, marginBottom: 12 },
  triggerRow: { borderTopWidth: 1, borderTopColor: '#312E81', paddingVertical: 8 },
  triggerDate: { color: '#818CF8', fontSize: 12 },
  triggerEmail: { color: '#FCA5A5', fontSize: 14 },
  triggerDomain: { color: '#A5B4FC', fontSize: 12 },
  noTriggers: { color: '#6B7280', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});
