import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://phantomdefender.com';

interface AuthScreenProps {
  onAuthenticated: (session: {
    access_token: string;
    refresh_token: string;
    userId: string;
    username: string;
    encryption_salt: string | null;
    key_check: string | null;
  }) => void;
}

type Mode = 'login' | 'signup';

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(username))
      return 'Username: letters, numbers, hyphens, underscores only';
    if (password.length < 8) return 'Master password must be at least 8 characters';
    if (mode === 'signup' && password !== confirmPassword)
      return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        await handleSignup();
      } else {
        await handleLogin();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    // Generate encryption salt and derive key check client-side
    // In production, use lib/crypto with expo-crypto for randomBytes
    const saltArray = new Uint8Array(32);
    if (typeof globalThis.crypto !== 'undefined') {
      globalThis.crypto.getRandomValues(saltArray);
    }
    const encryptionSalt = Array.from(saltArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Key check placeholder — in production, derive key via PBKDF2 and encrypt known string
    // For now, send the salt; the full crypto flow is handled by lib/crypto
    const keyCheck = 'pending-client-crypto';

    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.toLowerCase(),
        password,
        encryption_salt: encryptionSalt,
        key_check: keyCheck,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    if (data.session) {
      onAuthenticated({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        userId: data.user.id,
        username: data.user.username,
        encryption_salt: encryptionSalt,
        key_check: keyCheck,
      });
    } else {
      // Account created but auto-login failed — switch to login mode
      setMode('login');
      setError('Account created! Please log in.');
    }
  };

  const handleLogin = async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.toLowerCase(),
        password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    onAuthenticated({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      userId: data.user.id,
      username: data.user.username,
      encryption_salt: data.user.encryption_salt,
      key_check: data.user.key_check,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Phantom Defender</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text style={styles.privacyNote}>
            No email required. Your data stays encrypted.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a username"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
          />

          <Text style={styles.label}>Master Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your master password"
            placeholderTextColor="#666"
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {mode === 'signup' && (
            <>
              <Text style={styles.label}>Confirm Master Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your master password"
                placeholderTextColor="#666"
                secureTextEntry
                autoComplete="new-password"
              />
              <Text style={styles.warning}>
                Your master password encrypts all your data. If you forget it,
                your data cannot be recovered.
              </Text>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Log In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 4,
  },
  privacyNote: {
    fontSize: 13,
    color: '#666',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#fff',
  },
  warning: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 8,
    lineHeight: 18,
  },
  error: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchMode: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#6366f1',
    fontSize: 14,
  },
});
