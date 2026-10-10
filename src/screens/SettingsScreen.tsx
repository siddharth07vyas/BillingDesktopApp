import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { BluetoothDevice } from 'react-native-bluetooth-classic';
import { useQueryClient } from '@tanstack/react-query';
import { getSettings, setSettings } from '../db/repositories/settings';
import { exportDatabaseBackup, importDatabaseBackup } from '../db/backup';
import { usePrinter } from '../printer/PrinterContext';
import { useI18n, type Lang } from '../i18n';
import { describeTranslationError, translateManyToHindi, translationSupported } from '../i18n/translate';
import { listNamesForTranslation, saveHindiNames } from '../db/repositories/hindiNames';
import { AppButton, Card, Field, Screen } from '../components/ui';
import { colors } from '../theme';

export default function SettingsScreen() {
  const printer = usePrinter();
  const queryClient = useQueryClient();
  const { lang, setLang, t } = useI18n();
  const [translateProgress, setTranslateProgress] = useState<{ done: number; total: number } | null>(null);
  const [form, setForm] = useState({
    shopName: '',
    address: '',
    phone: '',
    gstin: '',
    footer: '',
    paperWidth: '80mm' as '58mm' | '80mm',
  });
  const [loaded, setLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BluetoothDevice[] | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setForm({
        shopName: s.shopName,
        address: s.address,
        phone: s.phone,
        gstin: s.gstin,
        footer: s.footer,
        paperWidth: s.paperWidth,
      });
      setLoaded(true);
    });
  }, []);

  const saveShopDetails = async () => {
    await setSettings({
      shopName: form.shopName,
      address: form.address,
      phone: form.phone,
      gstin: form.gstin,
      footer: form.footer,
      paperWidth: form.paperWidth,
    });
    Alert.alert(t('settings.savedTitle'), t('settings.shopDetailsUpdated'));
  };

  const translateNames = async (includeExisting: boolean) => {
    setTranslateProgress({ done: 0, total: 0 });
    let saved = 0;
    try {
      const rows = await listNamesForTranslation(includeExisting);
      if (rows.length === 0) {
        Alert.alert(t('settings.nothingToTranslateTitle'), t('settings.nothingToTranslateBody'));
        return;
      }
      setTranslateProgress({ done: 0, total: rows.length });
      // Save each chunk as it finishes so a failure part-way keeps the names already translated.
      await translateManyToHindi(
        rows.map((r) => r.name),
        (done, total) => setTranslateProgress({ done, total }),
        async (start, translated) => {
          const updates = translated
            .map((nameHi, i) => ({ table: rows[start + i].table, id: rows[start + i].id, nameHi }))
            .filter((r) => r.nameHi);
          await saveHindiNames(updates);
          saved += updates.length;
        }
      );
      Alert.alert(t('settings.translateDoneTitle'), t('settings.translateDoneBody', { count: saved }));
    } catch (err) {
      const partial = saved ? '\n\n' + t('settings.translatePartial', { count: saved }) : '';
      Alert.alert(t('settings.translateFailedTitle'), t('common.translateFailed') + partial + '\n\n' + describeTranslationError(err));
    } finally {
      for (const key of ['products', 'categories', 'subcategories', 'parties']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setTranslateProgress(null);
    }
  };

  const retranslateAll = () => {
    Alert.alert(t('settings.retranslateConfirmTitle'), t('settings.retranslateConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.retranslateConfirm'), style: 'destructive', onPress: () => translateNames(true) },
    ]);
  };

  const scan = async () => {
    setScanning(true);
    try {
      const paired = await printer.scanPairedDevices();
      setDevices(paired);
    } catch (err: any) {
      Alert.alert(t('settings.scanFailed'), String(err?.message ?? err));
    } finally {
      setScanning(false);
    }
  };

  const connect = async (device: BluetoothDevice) => {
    try {
      await printer.connect(device);
    } catch (err: any) {
      Alert.alert(t('settings.connectFailed'), String(err?.message ?? err));
    }
  };

  const testPrint = async () => {
    try {
      await printer.printReceipt({
        settings: await getSettings(),
        billNumber: 'TEST',
        createdAt: new Date().toISOString(),
        items: [{ name: 'Test item', qty: 1, price: 0 }],
        subtotal: 0,
        discount: 0,
        total: 0,
        paid: 0,
        paymentMode: 'cash',
      });
      Alert.alert(t('common.sent'), t('settings.testPrintSent'));
    } catch (err: any) {
      Alert.alert(t('common.printFailed'), String(err?.message ?? err));
    }
  };

  const backup = async () => {
    try {
      await exportDatabaseBackup();
    } catch (err: any) {
      Alert.alert(t('settings.backupFailed'), String(err?.message ?? err));
    }
  };

  const restore = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    Alert.alert(
      t('settings.restoreTitle'),
      t('settings.restoreConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.restore'),
          style: 'destructive',
          onPress: async () => {
            try {
              await importDatabaseBackup(result.assets![0].uri);
              Alert.alert(t('settings.restoredTitle'), t('settings.restoredBody'));
            } catch (err: any) {
              Alert.alert(t('settings.restoreFailed'), String(err?.message ?? err));
            }
          },
        },
      ]
    );
  };

  if (!loaded) return null;

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <Card style={{ padding: 18, flex: 1, minWidth: 300 }}>
            <Text style={{ fontWeight: '700', marginBottom: 10 }}>{t('settings.languageTitle')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                ['en', 'English'],
                ['hi', 'हिन्दी'],
              ] as [Lang, string][]).map(([code, label]) => (
                <Pressable
                  key={code}
                  onPress={() => setLang(code)}
                  style={{
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: lang === code ? colors.primary : colors.border,
                    backgroundColor: lang === code ? colors.primary : colors.surface,
                  }}
                >
                  <Text style={{ color: lang === code ? colors.primaryInk : colors.ink, fontWeight: '600' }}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginTop: 8 }}>{t('settings.receiptsStayEnglish')}</Text>
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 8 }}>{t('settings.translateNamesTitle')}</Text>
              {translationSupported ? (
                <>
                  <Text style={{ fontSize: 13, color: colors.inkSoft, marginBottom: 10 }}>{t('settings.translateNamesBody')}</Text>
                  <AppButton
                    title={
                      translateProgress
                        ? translateProgress.total
                          ? t('settings.translatingProgress', { done: translateProgress.done, total: translateProgress.total })
                          : t('common.translating')
                        : t('settings.translateMissing')
                    }
                    onPress={() => translateNames(false)}
                    disabled={translateProgress !== null}
                    style={{ marginBottom: 8 }}
                  />
                  <AppButton
                    title={t('settings.retranslateAll')}
                    variant="ghost"
                    small
                    onPress={retranslateAll}
                    disabled={translateProgress !== null}
                  />
                </>
              ) : (
                <Text style={{ fontSize: 12.5, color: colors.inkFaint }}>{t('settings.translateUnsupported')}</Text>
              )}
            </View>
          </Card>

          <Card style={{ padding: 18, flex: 1, minWidth: 300 }}>
            <Text style={{ fontWeight: '700', marginBottom: 10 }}>{t('settings.shopDetailsTitle')}</Text>
            <Field label={t('settings.shopName')} value={form.shopName} onChangeText={(v) => setForm((f) => ({ ...f, shopName: v }))} />
            <Field label={t('common.address')} value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label={t('common.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('settings.gstin')} value={form.gstin} onChangeText={(v) => setForm((f) => ({ ...f, gstin: v }))} />
              </View>
            </View>
            <Field label={t('settings.receiptFooter')} value={form.footer} onChangeText={(v) => setForm((f) => ({ ...f, footer: v }))} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 6 }}>{t('settings.paperWidth')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['58mm', '80mm'] as const).map((w) => (
                    <Pressable
                      key={w}
                      onPress={() => setForm((f) => ({ ...f, paperWidth: w }))}
                      style={{
                        paddingVertical: 9,
                        paddingHorizontal: 14,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: form.paperWidth === w ? colors.primary : colors.border,
                        backgroundColor: form.paperWidth === w ? colors.primary : colors.surface,
                      }}
                    >
                      <Text style={{ color: form.paperWidth === w ? colors.primaryInk : colors.ink, fontWeight: '600' }}>{w}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <AppButton title={t('settings.saveShopDetails')} onPress={saveShopDetails} style={{ marginTop: 6 }} />
          </Card>

          <Card style={{ padding: 18, flex: 1, minWidth: 300 }}>
            <Text style={{ fontWeight: '700', marginBottom: 10 }}>{t('settings.printerTitle')}</Text>
            {printer.connectedName ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <View>
                    <Text style={{ fontWeight: '700' }}>{printer.connectedName}</Text>
                    <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>{t('settings.connectedBluetooth')}</Text>
                  </View>
                  <AppButton title={t('settings.disconnect')} variant="ghost" small onPress={printer.disconnect} />
                </View>
                <AppButton title={t('settings.testPrint')} variant="ghost" onPress={testPrint} />
              </>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: colors.inkSoft, marginBottom: 10 }}>
                  {t('settings.printerHelp')}
                </Text>
                <AppButton title={scanning ? t('settings.scanning') : t('settings.scanForPrinters')} onPress={scan} disabled={scanning} />
                {devices?.map((d) => (
                  <View key={d.address} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginTop: 10 }}>
                    <Text style={{ fontWeight: '700' }}>{d.name ?? d.address}</Text>
                    <AppButton title={t('settings.connect')} small onPress={() => connect(d)} disabled={printer.isConnecting} />
                  </View>
                ))}
                {devices?.length === 0 ? (
                  <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginTop: 10 }}>
                    {t('settings.noPairedDevices')}
                  </Text>
                ) : null}
              </>
            )}
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 8 }}>{t('settings.backupTitle')}</Text>
              <AppButton title={t('settings.exportBackup')} variant="ghost" onPress={backup} style={{ marginBottom: 8 }} />
              <AppButton title={t('settings.restoreFromFile')} variant="ghost" onPress={restore} />
            </View>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
