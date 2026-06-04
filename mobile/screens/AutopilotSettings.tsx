import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';

type AutopilotMode = 'manual' | 'auto_kill';
type Threshold = 30 | 60 | 90;

interface AutopilotSettingsValue {
  autopilot_enabled: boolean;
  autopilot_mode: AutopilotMode;
  autopilot_auto_kill_days: Threshold;
}

interface AutopilotSettingsProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  initial: AutopilotSettingsValue;
  onScan: () => void;
}

const THRESHOLDS: Threshold[] = [30, 60, 90];

export function AutopilotSettings({ apiBaseUrl, getToken, initial, onScan }: AutopilotSettingsProps) {
  const [value, setValue] = useState<AutopilotSettingsValue>(initial);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (next: AutopilotSettingsValue) => {
      const previous = value;
      setValue(next);
      setSaving(true);
      try {
        const token = await getToken();
        const res = await fetch(`${apiBaseUrl}/api/v2/settings/autopilot`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(next),
        });
        if (!res.ok) throw new Error('save failed');
      } catch {
        setValue(previous);
        Alert.alert('Could not save', 'Your change was reverted.');
      } finally {
        setSaving(false);
      }
    },
    [apiBaseUrl, getToken, value]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Privacy Autopilot</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Enable Autopilot</Text>
        <Switch
          value={value.autopilot_enabled}
          onValueChange={(autopilot_enabled) => save({ ...value, autopilot_enabled })}
        />
      </View>

      {value.autopilot_enabled && (
        <>
          <Text style={styles.subtitle}>Mode</Text>
          {(['manual', 'auto_kill'] as AutopilotMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.option, value.autopilot_mode === mode && styles.optionActive]}
              onPress={() => save({ ...value, autopilot_mode: mode })}
            >
              <Text style={styles.optionLabel}>{mode === 'manual' ? 'Manual Review' : 'Auto-Kill'}</Text>
              <Text style={styles.explanation}>
                {mode === 'manual'
                  ? 'We notify you about stale identities; you decide what to keep or kill.'
                  : 'We automatically kill identities past your threshold each month.'}
              </Text>
            </TouchableOpacity>
          ))}

          {value.autopilot_mode === 'auto_kill' && (
            <>
              <Text style={styles.subtitle}>Auto-kill threshold</Text>
              <View style={styles.thresholdRow}>
                {THRESHOLDS.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.chip, value.autopilot_auto_kill_days === days && styles.chipActive]}
                    onPress={() => save({ ...value, autopilot_auto_kill_days: days })}
                  >
                    <Text style={styles.chipText}>{days} days</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </>
      )}

      <TouchableOpacity style={styles.scanButton} onPress={onScan}>
        <Text style={styles.scanButtonText}>Run Scan Now</Text>
      </TouchableOpacity>

      {saving && <ActivityIndicator style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#e5e5e5', marginBottom: 12 },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#e5e5e5', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  label: { fontSize: 15, color: '#e5e5e5' },
  option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 8 },
  optionActive: { borderColor: '#22d3ee', backgroundColor: '#0c2a30' },
  optionLabel: { fontSize: 15, fontWeight: '600', color: '#e5e5e5' },
  explanation: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  thresholdRow: { flexDirection: 'row' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8 },
  chipActive: { borderColor: '#22d3ee', backgroundColor: '#0c2a30' },
  chipText: { color: '#e5e5e5', fontSize: 13 },
  scanButton: { marginTop: 20, padding: 14, borderRadius: 10, backgroundColor: '#0c2a30', alignItems: 'center' },
  scanButtonText: { color: '#22d3ee', fontWeight: '600' },
  spinner: { marginTop: 12 },
});
