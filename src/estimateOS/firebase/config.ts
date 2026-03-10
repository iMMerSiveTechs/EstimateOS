// ─── Firebase initialization ───────────────────────────────────────────────
// All config values come from Expo public env vars.
// Copy .env.example → .env and fill in your Firebase project credentials.
//
// In Expo, env vars prefixed with EXPO_PUBLIC_ are available at runtime:
//   https://docs.expo.dev/guides/environment-variables/
//
// SAFETY: This module never throws at import time. If env vars are missing
// or initializeApp fails, exports are null and callers must guard with
// firebaseConfigured before using auth/db/storage/functions.

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { getAI, GoogleAIBackend, AI } from 'firebase/ai';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missingVars = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => 'EXPO_PUBLIC_FIREBASE_' + k.replace(/([A-Z])/g, '_$1').toUpperCase());

if (missingVars.length > 0) {
  console.error('[Firebase] Missing build-time env vars. Add to EAS Secrets:', missingVars);
}

// ── Safe initialization — never throws at module load ───────────────────────

let _app:       FirebaseApp       | null = null;
let _auth:      Auth              | null = null;
let _db:        Firestore         | null = null;
let _storage:   FirebaseStorage   | null = null;
let _functions: Functions         | null = null;
let _ai:        AI                | null = null;

try {
  const isNew = getApps().length === 0;
  _app       = isNew ? initializeApp(firebaseConfig as Record<string, string>) : getApp();
  // Use initializeAuth with device-level AsyncStorage persistence on first init.
  // On subsequent inits (e.g. hot reload) fall back to getAuth() which returns
  // the already-configured instance — calling initializeAuth twice would throw.
  _auth      = isNew
    ? initializeAuth(_app, { persistence: getReactNativePersistence(AsyncStorage) })
    : getAuth(_app);
  _db        = getFirestore(_app);
  _storage   = getStorage(_app);
  _functions = getFunctions(_app);
  // Gemini Developer API (free-tier on Spark plan). Uses GoogleAIBackend which
  // routes calls through the Gemini Developer API using the project's API key.
  // Switch to VertexAIBackend when upgrading to Blaze/production.
  _ai        = getAI(_app, { backend: new GoogleAIBackend() });
} catch (e) {
  console.error('[Firebase] initializeApp failed — app will run in offline/auth-disabled mode:', e);
}

export const firebaseConfigured = _app !== null;
export const auth      = _auth;
export const db        = _db;
export const storage   = _storage;
export const functions = _functions;
export const ai        = _ai;
