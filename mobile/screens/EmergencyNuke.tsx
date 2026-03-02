import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

interface EmergencyNukeProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  getBiometricToken: () => Promise<string | null>;
  onNukeComplete: () => void;
  nukeContactNumber?: string;
}

interface NukePreview {
  activeAliases: number;
  activePhones: number;
  gdprEligible: number;
}

export function EmergencyNuke({
  apiBaseUrl,
  getToken,
  getBiometricToken,
  onNukeComplete,
  nukeContactNumber,
}: EmergencyNukeProps) {
  const [step, setStep] = useState<'idle' | 'preview' | 'confirm' | 'loading' | 'done'>('idle');
  const [preview, setPreview] = useState<NukePreview | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [sendSafeMessage, setSendSafeMessage] = useState(false);
  const [result, setResult] = useState<{
    identities_killed: number;
    gdpr_emails_sent: number;
    recovery_deadline: string;
  } | null>(null);

  const fetchPreview = useCallback(async () => {
    try {
      const biometric = await getBiometricToken();
      if (!biometric) {
        Alert.alert('Authentication Required', 'Biometric verification failed.');
        return;
      }

      const token = await getToken();
      // Fetch identity counts for the preview
      const res = await fetch(`${apiBaseUrl}/api/v2/identities/count`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPreview({
          activeAliases: data.active_aliases || 0,
          activePhones: data.active_phones || 0,
          gdprEligible: data.gdpr_eligible || 0,
        });
      } else {
        setPreview({ activeAliases: 0, activePhones: 0, gdprEligible: 0 });
      }
      setStep('preview');
    } catch {
      Alert.alert('Error', 'Failed to load account data.');
    }
  }, [apiBaseUrl, getToken, getBiometricToken]);

  const executeNuke = useCallback(async () => {
    if (confirmText !== 'NUKE') return;
    setStep('loading');

    try {
      const token = await getToken();
      const biometric = await getBiometricToken();

      const res = await fetch(`${apiBaseUrl}/api/v2/nuke`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'x-biometric-token': biometric || '',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ confirm: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setStep('done');
      } else {
        const err = await res.json();
        Alert.alert('Nuke Failed', err.error || 'An error occurred.');
        setStep('idle');
      }
    } catch {
      Alert.alert('Error', 'Failed to execute nuke.');
      setStep('idle');
    }
  }, [apiBaseUrl, getToken, getBiometricToken, confirmText]);

  if (step === 'done' && result) {
    return (
      <View style={styles.container}>
        <View style={styles.doneCard}>
          <Text style={styles.doneIcon}>✅</Text>
          <Text style={styles.doneTitle}>Nuke Complete</Text>
          <Text style={styles.doneDetail}>
            {result.identities_killed} identities killed
          </Text>
          <Text style={styles.doneDetail}>
            {result.gdpr_emails_sent} deletion requests sent
          </Text>
          <Text style={styles.recoveryText}>
            Account recoverable until{'\n'}
            {new Date(result.recovery_deadline).toLocaleDateString()}
          </Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onNukeComplete}
            accessibilityLabel="Close and sign out"
            accessibilityRole="button"
          >
            <Text style={styles.doneButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#EF4444" />
        <Text style={styles.loadingText}>Executing emergency nuke...</Text>
        <Text style={styles.loadingSubtext}>
          Killing identities and sending deletion requests
        </Text>
      </View>
    );
  }

  if (step === 'preview' || step === 'confirm') {
    return (
      <View style={styles.container}>
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Emergency Nuke</Text>
          <Text style={styles.warningText}>This will:</Text>
          <Text style={styles.warningItem}>
            • Kill {preview?.activeAliases ?? '?'} email aliases
          </Text>
          <Text style={styles.warningItem}>
            • Release {preview?.activePhones ?? '?'} phone numbers
          </Text>
          <Text style={styles.warningItem}>
            • Send {preview?.gdprEligible ?? '?'} deletion requests
          </Text>
          <Text style={styles.warningItem}>
            • Soft-delete your account (recoverable 30 days)
          </Text>

          {nukeContactNumber && (
            <TouchableOpacity
              style={styles.safeToggle}
              onPress={() => setSendSafeMessage(!sendSafeMessage)}
              accessibilityLabel="Send I'm safe message toggle"
              accessibilityRole="switch"
            >
              <View style={[styles.checkbox, sendSafeMessage && styles.checkboxChecked]}>
                {sendSafeMessage && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.safeToggleText}>
                Send "I'm safe" to emergency contact
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.confirmLabel}>Type NUKE to confirm:</Text>
          <TextInput
            style={styles.confirmInput}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="NUKE"
            placeholderTextColor="#6B7280"
            autoCapitalize="characters"
            accessibilityLabel="Type NUKE to confirm"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setStep('idle'); setConfirmText(''); }}
              accessibilityLabel="Cancel nuke"
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.nukeConfirmButton,
                confirmText !== 'NUKE' && styles.nukeConfirmDisabled,
              ]}
              onPress={executeNuke}
              disabled={confirmText !== 'NUKE'}
              accessibilityLabel="Execute emergency nuke"
              accessibilityRole="button"
            >
              <Text style={styles.nukeConfirmText}>EXECUTE NUKE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Idle state
  return (
    <View style={styles.container}>
      <View style={styles.emergencySection}>
        <Text style={styles.sectionTitle}>Emergency</Text>
        <Text style={styles.sectionDesc}>
          Instantly kill all identities, send deletion requests to every service,
          and wipe your account. Use only in an emergency.
        </Text>
        <TouchableOpacity
          style={styles.nukeButton}
          onPress={fetchPreview}
          accessibilityLabel="Nuke everything"
          accessibilityRole="button"
        >
          <Text style={styles.nukeButtonText}>NUKE EVERYTHING</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0D23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emergencySection: {
    backgroundColor: '#2D0A0A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#FCA5A5',
    lineHeight: 22,
    marginBottom: 24,
  },
  nukeButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  nukeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  warningCard: {
    backgroundColor: '#2D0A0A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#EF4444',
    width: '100%',
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 16,
    color: '#FCA5A5',
    marginBottom: 8,
  },
  warningItem: {
    fontSize: 15,
    color: '#FECACA',
    marginBottom: 4,
    paddingLeft: 8,
  },
  safeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  safeToggleText: {
    color: '#A5B4FC',
    fontSize: 14,
  },
  confirmLabel: {
    fontSize: 14,
    color: '#FCA5A5',
    marginTop: 20,
    marginBottom: 8,
  },
  confirmInput: {
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#312E81',
    alignItems: 'center',
  },
  cancelText: {
    color: '#A5B4FC',
    fontSize: 16,
    fontWeight: '600',
  },
  nukeConfirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  nukeConfirmDisabled: {
    backgroundColor: '#4B1818',
    opacity: 0.5,
  },
  nukeConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  loadingText: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
  },
  loadingSubtext: {
    color: '#FCA5A5',
    fontSize: 14,
    marginTop: 8,
  },
  doneCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  doneIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E0E7FF',
    marginBottom: 16,
  },
  doneDetail: {
    fontSize: 16,
    color: '#A5B4FC',
    marginBottom: 4,
  },
  recoveryText: {
    fontSize: 14,
    color: '#FCD34D',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  doneButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
