// ─── Firebase Auth context ─────────────────────────────────────────────────
// Wraps Firebase Auth state in a React context so any screen can call
// useAuth() to get the current user and auth actions.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  UserCredential,
} from 'firebase/auth';
import { auth, firebaseConfigured } from '../firebase/config';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  firebaseAvailable: boolean;
  signIn: (email: string, password: string) => Promise<UserCredential>;
  signUp: (email: string, password: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // Firebase not configured — boot into unauthenticated state so the
      // app renders rather than hanging on the loading gate.
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = (email: string, password: string) => {
    if (!auth) return Promise.reject(new Error('Firebase not configured'));
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = (email: string, password: string) => {
    if (!auth) return Promise.reject(new Error('Firebase not configured'));
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = () => {
    if (!auth) return Promise.resolve();
    return firebaseSignOut(auth);
  };

  const resetPassword = (email: string) => {
    if (!auth) return Promise.reject(new Error('Firebase not configured'));
    return sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, firebaseAvailable: firebaseConfigured, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
