import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';

type ForwardMode = 'full' | 'summary' | 'digest';
type Frequency = 'daily' | 'weekly';

interface DigestSettingsValue {
  email_forward_mode: ForwardMode;
  digest_frequency: Frequency;
  digest_time: string; // HH:MM
  digest_day: number; // 0-6
}

interface DigestSettingsProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  initial: DigestSettingsValue;
}

const MODE_EXPLANATIONS: Record<ForwardMode, string> = {
  full: 'Forward every email to your inbox immediately, with trackers stripped.',
  summary: 'Forward emails immediately, but replace the body with an AI summary.',
  digest: 'Hold marketing emails and deliver them together on your schedule.',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function DigestSettings({ apiBaseUrl, getToken, initial }: DigestSettingsProps) {
  const [value, setValue] = useState<DigestSettingsValue>(initial);
  const [saving, setSaving] = useState(false);

  // Optimistic update with rollback on error.
  const save = useCallback(
    async (next: DigestSettingsValue) => {
      const previous = value;
      setValue(next);
      setSaving(true);

      // Validate before calling the API.
      if (!HH_MM.test(next.digest_time)) {
        Alert.alert('Invalid time', 'Time must be in HH:MM format.');
        setValue(previous);
        setSaving(false);
        return;
      }

      try {
        const token = await getToken();
        const res = await fetch(`${apiBaseUrl}/api/v2/settings/digest`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            email_forward_mode: next.email_forward_mode,
            digest_frequency: next.digest_frequency,
            digest_time: next.digest_time,
            digest_day: next.digest_day,
          }),
        });
        if (!res.ok) {
          throw new Error('Save failed');
        }
      } catch {
        // Roll back the optimistic change.
        setValue(previous);
        Alert.alert('Could not save', 'Your change was reverted. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [apiBaseUrl, getToken, value]
  );

  const setMode = (mode: ForwardMode) => save({ ...value, email_forward_mode: mode });
  const setFrequency = (frequency: Frequency) => save({ ...value, digest_frequency: frequency });
  const setDay = (digest_day: number) => save({ ...value, digest_day });

  const isDigest = value.email_forward_mode === 'digest';
  const isWeekly = value.digest_frequency === 'weekly';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Email Forwarding</Text>

      {(['full', 'summary', 'digest'] as ForwardMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[styles.option, value.email_forward_mode === mode && styles.optionActive]}
          onPress={() => setMode(mode)}
        >
          <Text style={styles.optionLabel}>{mode === 'full' ? 'Forward All' : mode === 'summary' ? 'Summaries Only' : 'Digest'}</Text>
          <Text style={styles.explanation}>{MODE_EXPLANATIONS[mode]}</Text>
        </TouchableOpacity>
      ))}

      {isDigest && (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Schedule</Text>
          <View style={styles.row}>
            {(['daily', 'weekly'] as Frequency[]).map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[styles.chip, value.digest_frequency === freq && styles.chipActive]}
                onPress={() => setFrequency(freq)}
              >
                <Text style={styles.chipText}>{freq === 'daily' ? 'Daily Digest' : 'Weekly Digest'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Time picker (HH:MM) — daily and weekly both need a delivery time. */}
          <Text style={styles.fieldLabel}>Delivery time</Text>
          <View style={styles.timeRow}>
            {['06:00', '08:00', '12:00', '18:00', '21:00'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, value.digest_time === t && styles.chipActive]}
                onPress={() => save({ ...value, digest_time: t })}
              >
                <Text style={styles.chipText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isWeekly && (
            <View>
              <Text style={styles.fieldLabel}>Day of week</Text>
              <View style={styles.timeRow}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, value.digest_day === i && styles.chipActive]}
                    onPress={() => setDay(i)}
                  >
                    <Text style={styles.chipText}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {saving && <ActivityIndicator style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 8 },
  optionActive: { borderColor: '#22d3ee', backgroundColor: '#0c2a30' },
  optionLabel: { fontSize: 15, fontWeight: '600', color: '#e5e5e5' },
  explanation: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  section: { marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8, marginBottom: 8 },
  chipActive: { borderColor: '#22d3ee', backgroundColor: '#0c2a30' },
  chipText: { color: '#e5e5e5', fontSize: 13 },
  fieldLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 6 },
  spinner: { marginTop: 12 },
});
