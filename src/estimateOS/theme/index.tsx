// ─── EstimateOS Design Tokens ────────────────────────────────────────────────
// Dark-first palette. All screens import from here.
// Named: T (main palette), AI_D (AI screen dark variant), radii, spacing.
// Component helpers: GlassPanel, GlowButton, Chip, FieldLabel, SectionHeader.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';

// ─── Main palette ─────────────────────────────────────────────────────────────

export const T = {
  // Backgrounds
  bg:       '#0B0F1A',    // app background (deepest)
  surface:  '#131929',    // card / sheet surface
  card:     '#1A2235',    // elevated card
  elevated: '#1F2940',    // modal / popover

  // Text
  text:     '#F1F5FB',    // primary text
  textDim:  '#A8B5CC',    // secondary / label text
  sub:      '#6B7A99',    // subdued
  muted:    '#3D4E6B',    // placeholder / disabled

  // Borders
  border:   '#253047',    // standard border
  borderHi: '#3A4D6A',    // highlighted border

  // Accent (brand blue)
  accent:   '#3B82F6',    // primary accent
  accentLo: '#1E3A5F',    // accent tint background
  accentHi: '#93C5FD',    // accent light (on dark)

  // Green (success / won / paid)
  green:    '#22C55E',
  greenLo:  '#14532D',
  greenHi:  '#86EFAC',

  // Amber (warning / in-progress)
  amber:    '#F59E0B',
  amberLo:  '#451A03',    // deep amber tint
  amberHi:  '#FCD34D',

  // Red (error / overdue / lost)
  red:      '#EF4444',
  redLo:    '#450A0A',
  redHi:    '#FCA5A5',

  // Indigo (AI / new leads)
  indigo:   '#6366F1',
  indigoLo: '#1E1B4B',
  indigoHi: '#A5B4FC',

  // Teal (quote sent / info)
  teal:     '#14B8A6',
  tealLo:   '#042F2E',
  tealHi:   '#5EEAD4',

  // Purple (appointment / scheduled)
  purple:   '#A855F7',
  purpleLo: '#2E1065',
  purpleHi: '#D8B4FE',
} as const;

// ─── AI screen dark palette variant ──────────────────────────────────────────

export const AI_D = {
  bg:       '#070B14',
  surface:  '#0F1524',
  card:     '#151E33',
  cardHi:   '#1C2740',
  border:   '#1E2E4A',
  borderHi: '#2A3F60',
  border2:  '#334D72',
} as const;

// ─── Border radii ─────────────────────────────────────────────────────────────

export const radii = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
} as const;

// ─── Spacing scale ────────────────────────────────────────────────────────────

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  20,
  xl:  28,
  xxl: 40,
} as const;

// ─── Reusable styled components ───────────────────────────────────────────────
// These are exported for convenience. Most screens use StyleSheet.create inline.

interface GlassPanelProps { children: React.ReactNode; style?: ViewStyle }
export function GlassPanel({ children, style }: GlassPanelProps) {
  return (
    <View style={[{ backgroundColor: T.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: T.border }, style]}>
      {children}
    </View>
  );
}

interface GlowButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}
export function GlowButton({ label, onPress, color = T.accent, disabled = false, style, textStyle }: GlowButtonProps) {
  return (
    <TouchableOpacity
      style={[{ backgroundColor: color, borderRadius: radii.lg, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', opacity: disabled ? 0.5 : 1 }, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[{ color: '#fff', fontSize: 15, fontWeight: '700' }, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

interface ChipProps { label: string; active?: boolean; onPress?: () => void; style?: ViewStyle }
export function Chip({ label, active = false, onPress, style }: ChipProps) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[{
        borderWidth: 1,
        borderColor: active ? T.accent : T.border,
        borderRadius: radii.lg,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: active ? T.accentLo : T.surface,
      }, style]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={{ color: active ? T.accentHi : T.sub, fontSize: 13, fontWeight: active ? '700' : '500' }}>
        {label}
      </Text>
    </Wrapper>
  );
}

interface FieldLabelProps { children: string; required?: boolean }
export function FieldLabel({ children, required }: FieldLabelProps) {
  return (
    <Text style={{ color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 }}>
      {children}{required ? <Text style={{ color: T.red }}> *</Text> : null}
    </Text>
  );
}

interface SectionHeaderProps { title: string }
export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <Text style={{
      color: T.textDim,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginTop: 28,
      marginBottom: 10,
    }}>
      {title}
    </Text>
  );
}
