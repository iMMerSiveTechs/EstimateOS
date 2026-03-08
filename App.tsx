// ─── ISOLATION BUILD — ENTRY OK TEST ─────────────────────────────────────────
// This build exists solely to prove React can paint in a TestFlight release.
// Zero providers, zero firebase, zero navigation, zero services.
// If this shows "ENTRY OK" on device, the real failure is in an import.
// Restore full App.tsx from git history after confirming.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={s.root}>
      <Text style={s.label}>ENTRY OK</Text>
      <Text style={s.sub}>React is painting. Problem is in providers/imports.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000000',
  },
  sub: {
    marginTop: 12,
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
