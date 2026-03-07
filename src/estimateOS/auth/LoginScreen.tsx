// ─── Login / Signup screen ─────────────────────────────────────────────────
// Email + password auth backed by Firebase Auth.
// Toggle between login and signup with a single tap.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from './AuthContext';
import { T, radii, spacing } from '../theme';

export function LoginScreen() {
  const { signIn, signUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      // AuthContext.onAuthStateChanged will update user → navigate away
    } catch (e: any) {
      const code: string = e?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(e?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.title}>EstimateOS</Text>
          <Text style={s.subtitle}>{isSignUp ? 'Create an account' : 'Sign in to continue'}</Text>

          {!!error && <Text style={s.error}>{error}</Text>}

          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={(t) => { setEmail(t); setError(''); }}
            placeholder="you@example.com"
            placeholderTextColor={T.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            placeholder="••••••••"
            placeholderTextColor={T.muted}
            secureTextEntry
            editable={!loading}
          />

          {isSignUp && (
            <>
              <Text style={s.label}>Confirm Password</Text>
              <TextInput
                style={s.input}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                placeholder="••••••••"
                placeholderTextColor={T.muted}
                secureTextEntry
                editable={!loading}
              />
            </>
          )}

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.toggle}
            onPress={() => { setIsSignUp((v) => !v); setError(''); }}
            disabled={loading}
          >
            <Text style={s.toggleText}>
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg ?? 24,
  },
  card: {
    backgroundColor: T.surface,
    borderRadius: radii.xl,
    padding: spacing.lg ?? 24,
    borderWidth: 1,
    borderColor: T.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: T.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: T.textDim,
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    color: T.sub,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: T.text,
    fontSize: 15,
    marginBottom: 16,
  },
  button: {
    backgroundColor: T.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggle: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: T.accent, fontSize: 14 },
  error: {
    color: T.red,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
});
