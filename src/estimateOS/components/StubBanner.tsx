/**
 * StubBanner.tsx — Calm, consistent banner for stubbed/demo features.
 *
 * Shows a single-line notice when a feature requires provider setup.
 * Does not clutter the UX — fits inline and uses muted styling.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { T, radii } from '../theme';

interface Props {
  /** Short label: "AI Analysis", "Online Payments", "Maps", "Email Send" */
  feature: string;
  /** What the user should do: "Enable in Settings → Integrations" */
  action?: string;
  /** If provided, tapping the banner navigates here. */
  onSetup?: () => void;
  /** Variant: 'inline' (default, light) or 'card' (more prominent). */
  variant?: 'inline' | 'card';
}

export function StubBanner({ feature, action, onSetup, variant = 'inline' }: Props) {
  const isCard = variant === 'card';
  const Wrapper = onSetup ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[isCard ? s.card : s.inline]}
      {...(onSetup ? { onPress: onSetup } : {})}
    >
      <Text style={s.icon}>⚙️</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.label, isCard && s.labelCard]}>
          {feature} — setup required
        </Text>
        {action && <Text style={s.action}>{action}</Text>}
      </View>
      {onSetup && <Text style={s.arrow}>→</Text>}
    </Wrapper>
  );
}

const s = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: T.surface, borderRadius: radii.md, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: T.amberLo, borderRadius: radii.lg, borderWidth: 1, borderColor: T.amber, marginBottom: 12 },
  icon: { fontSize: 16 },
  label: { color: T.muted, fontSize: 12, fontWeight: '600' },
  labelCard: { color: T.amberHi, fontSize: 13 },
  action: { color: T.sub, fontSize: 11, marginTop: 1 },
  arrow: { color: T.muted, fontSize: 16 },
});
