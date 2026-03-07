/**
 * CreditPurchaseModal.tsx
 *
 * Credit purchase UI + auto-reload settings.
 *
 * Stripe state:
 *   - When stripeEnabled = false (default): shows "Billing setup required" clearly.
 *     Does NOT simulate a purchase.
 *   - When stripeEnabled = true: shows purchase packs (Stripe SDK wiring is a TODO).
 *
 * Auto-reload:
 *   - User can opt in and choose default reload pack.
 *   - Setting is persisted via saveCreditSettings().
 *   - Clearly shows "billing setup required" state when Stripe not configured.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  ActivityIndicator, Switch, SafeAreaView, Alert,
} from 'react-native';
import { T, radii } from '../theme';
import {
  AI_CREDIT_PACKS, AiCreditPack, AiCreditSettings, AutoReloadSettings,
  AI_CREDITS_LOW_THRESHOLD,
} from '../models/types';
import {
  getCredits, getCreditSettings, saveCreditSettings, purchaseCredits,
  DEFAULT_AUTO_RELOAD,
} from '../storage/aiCredits';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pass integration.stripeEnabled from AppSettings */
  stripeEnabled: boolean;
  /** Called after a successful purchase with the new balance */
  onPurchased?: (newBalance: number) => void;
}

export function CreditPurchaseModal({ visible, onClose, stripeEnabled, onPurchased }: Props) {
  const [balance, setBalance]               = useState(0);
  const [settings, setSettings]             = useState<AiCreditSettings>({ autoReload: DEFAULT_AUTO_RELOAD });
  const [purchasing, setPurchasing]         = useState<string | null>(null); // packId being purchased
  const [loading, setLoading]               = useState(false);
  const [savingAutoReload, setSavingAutoReload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bal, cs] = await Promise.all([getCredits(), getCreditSettings()]);
      setBalance(bal.balance);
      setSettings(cs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const handlePurchase = async (pack: AiCreditPack) => {
    if (!stripeEnabled) {
      Alert.alert(
        'Billing Not Configured',
        'Stripe billing has not been set up yet. Configure your Stripe keys in Settings → Integrations to enable credit purchases.',
        [{ text: 'OK' }],
      );
      return;
    }
    setPurchasing(pack.id);
    try {
      const result = await purchaseCredits(pack.id, stripeEnabled);
      if (result.success) {
        setBalance(result.newBalance);
        onPurchased?.(result.newBalance);
        Alert.alert('Credits Added', `${pack.credits} credits added to your account.`);
      } else {
        Alert.alert('Purchase Failed', result.message);
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleAutoReloadChange = async (patch: Partial<AutoReloadSettings>) => {
    const next: AiCreditSettings = {
      ...settings,
      autoReload: { ...settings.autoReload, ...patch },
    };
    setSettings(next);
    setSavingAutoReload(true);
    try { await saveCreditSettings(next); }
    finally { setSavingAutoReload(false); }
  };

  const creditColor = balance <= 0 ? T.red : balance <= AI_CREDITS_LOW_THRESHOLD ? T.amber : T.green;
  const creditLabel = balance <= 0 ? 'No Credits' : balance <= AI_CREDITS_LOW_THRESHOLD ? 'Credits Low' : 'Credits OK';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Text style={s.close}>Done</Text></TouchableOpacity>
          <Text style={s.title}>AI Credits</Text>
          <View style={{ width: 50 }} />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={T.accent} />
        ) : (
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

            {/* Balance */}
            <View style={s.balanceCard}>
              <View style={[s.balanceDot, { backgroundColor: creditColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.balanceLabel}>Current Balance</Text>
                <Text style={[s.balanceCount, { color: creditColor }]}>{balance} credits</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: creditColor + '22', borderColor: creditColor }]}>
                <Text style={[s.statusBadgeTxt, { color: creditColor }]}>{creditLabel}</Text>
              </View>
            </View>

            {/* Stripe not configured notice */}
            {!stripeEnabled && (
              <View style={s.noticeCard}>
                <Text style={s.noticeIcon}>⚙️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.noticeTitle}>Billing Setup Required</Text>
                  <Text style={s.noticeTxt}>
                    Configure your Stripe publishable key in Settings → Integrations to enable credit purchases.
                  </Text>
                </View>
              </View>
            )}

            {/* Credit packs */}
            <Text style={s.sectionLabel}>BUY CREDITS</Text>
            {AI_CREDIT_PACKS.map(pack => {
              const isBuying = purchasing === pack.id;
              return (
                <TouchableOpacity
                  key={pack.id}
                  style={[s.packCard, pack.popular && s.packCardPopular]}
                  onPress={() => handlePurchase(pack)}
                  disabled={!!purchasing}
                >
                  {pack.popular && (
                    <View style={s.popularBadge}><Text style={s.popularBadgeTxt}>Most Popular</Text></View>
                  )}
                  <View style={s.packRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.packLabel}>{pack.label}</Text>
                      <Text style={s.packSub}>~{Math.round(pack.credits / 1)} analyses</Text>
                    </View>
                    <View style={s.packRight}>
                      <Text style={s.packPrice}>{pack.priceLabel}</Text>
                      {isBuying ? (
                        <ActivityIndicator size="small" color={T.accent} />
                      ) : (
                        <Text style={[s.packBuyBtn, !stripeEnabled && s.packBuyBtnDim]}>
                          {stripeEnabled ? 'Buy' : 'Setup Required'}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Auto-reload */}
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>AUTO-RELOAD</Text>
            <View style={s.autoReloadCard}>
              <View style={s.autoReloadRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.autoReloadLabel}>Auto-reload credits</Text>
                  <Text style={s.autoReloadSub}>
                    Automatically purchase credits when balance runs low
                  </Text>
                  {!stripeEnabled && (
                    <Text style={s.autoReloadWarning}>⚠ Billing setup required to activate</Text>
                  )}
                </View>
                <Switch
                  value={settings.autoReload.enabled}
                  onValueChange={v => handleAutoReloadChange({ enabled: v })}
                  disabled={savingAutoReload || !stripeEnabled}
                  trackColor={{ false: T.border, true: T.accentLo }}
                  thumbColor={settings.autoReload.enabled ? T.accent : T.sub}
                />
              </View>

              {settings.autoReload.enabled && (
                <>
                  <View style={s.divider} />
                  <Text style={s.autoReloadSub}>Reload when balance drops below {settings.autoReload.threshold} credits</Text>
                  <Text style={[s.autoReloadSub, { marginTop: 8 }]}>Default pack:</Text>
                  <View style={s.packPickerRow}>
                    {AI_CREDIT_PACKS.map(pack => (
                      <TouchableOpacity
                        key={pack.id}
                        style={[s.packChip, settings.autoReload.packId === pack.id && s.packChipActive]}
                        onPress={() => handleAutoReloadChange({ packId: pack.id })}
                      >
                        <Text style={[s.packChipTxt, settings.autoReload.packId === pack.id && { color: T.accent }]}>
                          {pack.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Human-review note */}
            <View style={s.trustNote}>
              <Text style={s.trustNoteIcon}>🧑‍💼</Text>
              <Text style={s.trustNoteTxt}>
                AI assists — humans confirm. All estimates require operator review before sending to customers.
              </Text>
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  title:  { color: T.text, fontSize: 17, fontWeight: '700' },
  close:  { color: T.accent, fontSize: 16, fontWeight: '600' },
  scroll: { padding: 20, paddingBottom: 48 },

  balanceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, marginBottom: 16 },
  balanceDot:  { width: 12, height: 12, borderRadius: 6 },
  balanceLabel:{ color: T.sub, fontSize: 12, marginBottom: 2 },
  balanceCount:{ fontSize: 24, fontWeight: '800' },
  statusBadge: { borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusBadgeTxt: { fontSize: 11, fontWeight: '700' },

  noticeCard: { flexDirection: 'row', gap: 10, backgroundColor: T.amberLo, borderRadius: radii.md, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: T.amber },
  noticeIcon: { fontSize: 20 },
  noticeTitle:{ color: T.amberHi, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  noticeTxt:  { color: T.amberHi, fontSize: 12, lineHeight: 17 },

  sectionLabel: { color: T.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },

  packCard:       { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.border },
  packCardPopular:{ borderColor: T.accent },
  popularBadge:   { alignSelf: 'flex-start', backgroundColor: T.accentLo, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8, borderWidth: 1, borderColor: T.accent },
  popularBadgeTxt:{ color: T.accent, fontSize: 10, fontWeight: '800' },
  packRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  packLabel:      { color: T.text, fontSize: 16, fontWeight: '700' },
  packSub:        { color: T.sub, fontSize: 12, marginTop: 2 },
  packRight:      { alignItems: 'flex-end', gap: 6 },
  packPrice:      { color: T.text, fontSize: 18, fontWeight: '800' },
  packBuyBtn:     { color: T.accent, fontSize: 14, fontWeight: '700' },
  packBuyBtnDim:  { color: T.muted },

  autoReloadCard:{ backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, marginBottom: 16 },
  autoReloadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  autoReloadLabel:{ color: T.text, fontSize: 15, fontWeight: '600' },
  autoReloadSub: { color: T.sub, fontSize: 12, marginTop: 3 },
  autoReloadWarning: { color: T.amber, fontSize: 11, marginTop: 5, fontWeight: '600' },
  divider:       { height: 1, backgroundColor: T.border, marginVertical: 12 },
  packPickerRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  packChip:      { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 6 },
  packChipActive:{ borderColor: T.accent, backgroundColor: T.accentLo },
  packChipTxt:   { color: T.textDim, fontSize: 12, fontWeight: '600' },

  trustNote:    { flexDirection: 'row', gap: 10, backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border, alignItems: 'flex-start' },
  trustNoteIcon:{ fontSize: 18 },
  trustNoteTxt: { color: T.sub, fontSize: 12, lineHeight: 17, flex: 1 },
});
