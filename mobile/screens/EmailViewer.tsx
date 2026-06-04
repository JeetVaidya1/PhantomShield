import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { decryptEmailBody } from '../lib/crypto';

interface EmailSummary {
  id: string;
  email_from: string;
  email_subject: string;
  full_body_encrypted: string | null;
  trackers_stripped: number;
  is_leak?: boolean;
  reverse_alias?: string | null;
}

interface EmailViewerProps {
  apiBaseUrl: string;
  getToken: () => Promise<string>;
  email: EmailSummary;
  onDeleted: (id: string) => void;
  onReply: (reverseAlias: string) => void;
}

export function EmailViewer({ apiBaseUrl, getToken, email, onDeleted, onReply }: EmailViewerProps) {
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [loadImages, setLoadImages] = useState(false);

  // Biometric gate — the decrypted body is sensitive content.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock to view this email',
        });
        if (cancelled) return;
        if (!result.success) {
          Alert.alert('Locked', 'Biometric verification is required to view email content.');
          setLoading(false);
          return;
        }
        setUnlocked(true);

        // Decrypt locally using the key from secure storage. Works offline:
        // no network needed once the encrypted body is cached.
        const keyHex = await SecureStore.getItemAsync('encryption_key');
        if (!keyHex || !email.full_body_encrypted) {
          setLoading(false);
          return;
        }
        const plaintext = decryptEmailBody(email.full_body_encrypted, keyHex);
        if (!cancelled) {
          setBody(plaintext);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          Alert.alert('Could not open', 'Failed to decrypt this email.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email.full_body_encrypted]);

  // Block image loading until the user opts in (prevents tracker re-loading).
  const sanitizedHtml = useCallback(() => {
    if (!body) return '';
    if (loadImages) return body;
    return body.replace(/<img\b/gi, '<img data-blocked="1" src="" data-');
  }, [body, loadImages]);

  // External links open in the system browser, never inside the WebView.
  const handleShouldStartLoad = useCallback((req: { url: string }) => {
    if (req.url.startsWith('http')) {
      Linking.openURL(req.url);
      return false;
    }
    return true;
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${apiBaseUrl}/api/v2/email/${email.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('delete failed');
      onDeleted(email.id);
    } catch {
      Alert.alert('Delete failed', 'Please try again.');
    }
  }, [apiBaseUrl, getToken, email.id, onDeleted]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!unlocked) {
    return (
      <View style={styles.center}>
        <Text style={styles.locked}>This email is locked.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subject}>{email.email_subject}</Text>
      <Text style={styles.from}>{email.email_from}</Text>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {email.trackers_stripped} tracker{email.trackers_stripped === 1 ? '' : 's'} were stripped from this email
        </Text>
      </View>

      {email.is_leak && (
        <View style={[styles.banner, styles.leakBanner]}>
          <Text style={styles.bannerText}>⚠️ Possible data leak: this sender doesn’t match the labeled service.</Text>
        </View>
      )}

      {!loadImages && (
        <TouchableOpacity style={styles.imageButton} onPress={() => setLoadImages(true)}>
          <Text style={styles.imageButtonText}>Load Images</Text>
        </TouchableOpacity>
      )}

      <WebView
        originWhitelist={['about:']}
        source={{ html: sanitizedHtml() }}
        javaScriptEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        style={styles.webview}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => email.reverse_alias && onReply(email.reverse_alias)}
        >
          <Text style={styles.actionText}>Reply via Alias</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  locked: { color: '#9ca3af' },
  subject: { fontSize: 18, fontWeight: '700', color: '#e5e5e5' },
  from: { fontSize: 13, color: '#9ca3af', marginBottom: 12 },
  banner: { backgroundColor: '#0c2a30', borderRadius: 8, padding: 10, marginBottom: 8 },
  leakBanner: { backgroundColor: '#3a1212' },
  bannerText: { color: '#e5e5e5', fontSize: 13 },
  imageButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#22d3ee', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8 },
  imageButtonText: { color: '#22d3ee', fontSize: 13 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  actions: { flexDirection: 'row', marginTop: 12 },
  actionButton: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#0c2a30', alignItems: 'center', marginRight: 8 },
  deleteButton: { backgroundColor: '#3a1212', marginRight: 0 },
  actionText: { color: '#e5e5e5', fontWeight: '600' },
});
