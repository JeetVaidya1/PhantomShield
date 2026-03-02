import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
} from 'react-native';

interface ExportSettingsProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  getBiometricToken: () => Promise<string | null>;
}

export function ExportSettings({
  apiBaseUrl,
  getToken,
  getBiometricToken,
}: ExportSettingsProps) {
  const [loading, setLoading] = useState<'json' | 'csv' | null>(null);

  const handleExport = useCallback(
    async (format: 'json' | 'csv') => {
      try {
        const biometric = await getBiometricToken();
        if (!biometric) {
          Alert.alert('Authentication Required', 'Biometric verification failed.');
          return;
        }

        setLoading(format);
        const token = await getToken();
        const res = await fetch(
          `${apiBaseUrl}/api/v2/export?format=${format}`,
          {
            headers: {
              authorization: `Bearer ${token}`,
              'x-biometric-token': biometric,
            },
          }
        );

        if (!res.ok) {
          throw new Error('Export failed');
        }

        const content = await res.text();
        const filename = `phantom-defender-export.${format}`;

        await Share.share({
          message: content,
          title: filename,
        });
      } catch {
        Alert.alert('Export Failed', 'Could not generate export. Please try again.');
      } finally {
        setLoading(null);
      }
    },
    [apiBaseUrl, getToken, getBiometricToken]
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Export My Data</Text>
      <Text style={styles.sectionDesc}>
        Download all your data including identities, tracker stats, leak
        detections, and GDPR request history.
      </Text>

      <TouchableOpacity
        style={styles.exportButton}
        onPress={() => handleExport('json')}
        disabled={loading !== null}
        accessibilityLabel="Export as JSON"
        accessibilityRole="button"
      >
        {loading === 'json' ? (
          <ActivityIndicator size="small" color="#E0E7FF" />
        ) : (
          <Text style={styles.exportText}>Export as JSON</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.exportButton}
        onPress={() => handleExport('csv')}
        disabled={loading !== null}
        accessibilityLabel="Export as CSV"
        accessibilityRole="button"
      >
        {loading === 'csv' ? (
          <ActivityIndicator size="small" color="#E0E7FF" />
        ) : (
          <Text style={styles.exportText}>Export as CSV</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E0E7FF',
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#A5B4FC',
    lineHeight: 22,
    marginBottom: 16,
  },
  exportButton: {
    backgroundColor: '#312E81',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  exportText: {
    color: '#E0E7FF',
    fontSize: 16,
    fontWeight: '600',
  },
});
