import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelBill, getBillItems, listRecentBills, todaysSalesSummary } from '../db/repositories/bills';
import { getSettings } from '../db/repositories/settings';
import { usePrinter } from '../printer/PrinterContext';
import { BillSummary } from '../components/BillSummary';
import type { Bill } from '../types/models';
import { cashPaidTodayForPurchases, listPurchases } from '../db/repositories/purchases';
import { recordDayClosing } from '../db/repositories/dayClosing';
import { listParties } from '../db/repositories/parties';
import { listProducts } from '../db/repositories/products';
import { useI18n } from '../i18n';
import { AppButton, Badge, Card, EmptyState, Field, Screen, Sheet } from '../components/ui';
import { colors, space } from '../theme';
import { formatDateTime, formatMoney, todayDateString } from '../format';

export default function ReportsScreen() {
  const queryClient = useQueryClient();
  const { t, n } = useI18n();
  const printer = usePrinter();
  const [openBill, setOpenBill] = useState<Bill | null>(null);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [openingCash, setOpeningCash] = useState('2000');
  const [countedCash, setCountedCash] = useState('');
  const [result, setResult] = useState<{ expected: number; difference: number } | null>(null);

  const summaryQuery = useQuery({ queryKey: ['todaySummary'], queryFn: todaysSalesSummary });
  const purchasesCashQuery = useQuery({ queryKey: ['purchasesCashToday'], queryFn: cashPaidTodayForPurchases });
  const billsQuery = useQuery({ queryKey: ['recentBills'], queryFn: () => listRecentBills(10) });
  const purchasesQuery = useQuery({ queryKey: ['recentPurchases'], queryFn: () => listPurchases(10) });
  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: listParties });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const summary = summaryQuery.data ?? { totalSales: 0, cashCollected: 0, udharGiven: 0, billCount: 0 };
  const cashPaidOut = purchasesCashQuery.data ?? 0;
  const bills = billsQuery.data ?? [];
  const purchases = purchasesQuery.data ?? [];
  const parties = partiesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  // English name, used on printed receipts.
  const partyName = (id: number | null) => (id ? parties.find((p) => p.id === id)?.name ?? '—' : 'Walk-in');
  // Name shown on screen (Hindi in Hindi mode when available).
  const displayPartyName = (id: number | null) => {
    if (!id) return t('common.walkIn');
    const party = parties.find((p) => p.id === id);
    return party ? n(party) : '—';
  };
  const paymentModeLabel = (mode: Bill['paymentMode']) =>
    mode === 'cash' ? t('common.cash') : mode === 'udhar' ? t('common.udhar') : t('common.split');

  const openBillItemsQuery = useQuery({
    queryKey: ['billItems', openBill?.id],
    queryFn: () => getBillItems(openBill!.id),
    enabled: openBill !== null,
  });
  // English item names for printed receipts.
  const openBillItems = (openBillItemsQuery.data ?? []).map((it) => ({ name: it.nameSnapshot, qty: it.qty, price: it.unitPrice }));
  // Item names shown on screen.
  const openBillDisplayItems = (openBillItemsQuery.data ?? []).map((it) => {
    const product = products.find((p) => p.id === it.productId);
    return { name: product ? n(product) : it.nameSnapshot, qty: it.qty, price: it.unitPrice };
  });

  const cancelMutation = useMutation({
    mutationFn: ({ billId, reason }: { billId: number; reason: string | null }) => cancelBill(billId, reason),
    onSuccess: () => {
      for (const key of ['recentBills', 'todaySummary', 'products', 'parties', 'ledger', 'movements']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setCancelVisible(false);
      setCancelReason('');
      setOpenBill(null);
      Alert.alert(t('reports.billCancelledTitle'), t('reports.billCancelledBody'));
    },
    onError: (err: any) => Alert.alert(t('reports.cancelFailed'), String(err?.message ?? err)),
  });

  const reprint = async () => {
    if (!openBill || !openBillItemsQuery.data) return;
    if (!printer.connectedAddress) {
      Alert.alert(t('common.noPrinterTitle'), t('common.noPrinterBody'));
      return;
    }
    try {
      await printer.printReceipt({
        settings: await getSettings(),
        billNumber: openBill.number,
        createdAt: openBill.createdAt,
        partyName: openBill.partyId ? partyName(openBill.partyId) : null,
        items: openBillItems,
        subtotal: openBill.subtotal,
        discount: openBill.discount,
        total: openBill.total,
        paid: openBill.paidAmount,
        paymentMode: openBill.paymentMode,
      });
      Alert.alert(t('common.sent'), t('common.sentTo', { name: printer.connectedName ?? '' }));
    } catch (err: any) {
      Alert.alert(t('common.printFailed'), String(err?.message ?? err));
    }
  };

  const calculate = () => {
    const open = Number(openingCash) || 0;
    const expected = open + summary.cashCollected - cashPaidOut;
    const counted = Number(countedCash) || 0;
    setResult({ expected, difference: counted - expected });
    recordDayClosing({
      date: todayDateString(),
      openingCash: open,
      expectedCash: expected,
      countedCash: counted,
      note: null,
    }).then(() => queryClient.invalidateQueries({ queryKey: ['dayClosings'] }));
  };

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <Stat label={t('reports.todaysSales')} value={formatMoney(summary.totalSales)} hint={t('reports.billCount', { count: summary.billCount })} />
              <Stat label={t('reports.cashCollected')} value={formatMoney(summary.cashCollected)} hint={t('reports.cashCollectedHint')} />
              <Stat label={t('reports.purchasesPaidCash')} value={formatMoney(cashPaidOut)} valueColor={colors.accent} hint={t('reports.purchasesPaidHint')} />
              <Stat label={t('reports.udharGiven')} value={formatMoney(summary.udharGiven)} valueColor={colors.danger} hint={t('reports.udharGivenHint')} />
            </View>

            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
              <Card style={{ padding: 18, flex: 1 }}>
                <Text style={{ fontWeight: '700', marginBottom: 4 }}>{t('reports.cashClosing')}</Text>
                <Text style={{ fontSize: 12, color: colors.inkFaint, marginBottom: 10 }}>
                  {t('reports.cashClosingHint')}
                </Text>
                <Field label={t('reports.openingCash')} value={openingCash} onChangeText={setOpeningCash} keyboardType="numeric" />
                <Field label={t('reports.countedCash')} value={countedCash} onChangeText={setCountedCash} keyboardType="numeric" placeholder={t('reports.countedCashPlaceholder')} />
                {result ? (
                  <View style={{ marginBottom: 10 }}>
                    <Row left={t('reports.rowCashSales')} right={formatMoney(summary.cashCollected)} />
                    <Row left={t('reports.rowPurchasesPaid')} right={formatMoney(cashPaidOut)} />
                    <Row left={t('reports.expectedCash')} right={formatMoney(result.expected)} />
                    <Row
                      left={t('reports.difference')}
                      right={(result.difference > 0 ? '+' : '') + formatMoney(result.difference)}
                      bold
                      color={result.difference === 0 ? colors.success : colors.danger}
                    />
                  </View>
                ) : null}
                <AppButton title={t('reports.calculateAndSave')} onPress={calculate} />
              </Card>

              <Card style={{ padding: 18, flex: 1, maxHeight: 360 }}>
                <Text style={{ fontWeight: '700', marginBottom: 10 }}>{t('reports.recentBills')}</Text>
                <ScrollView nestedScrollEnabled>
                  {bills.length === 0 ? <EmptyState label={t('reports.noBills')} /> : null}
                  {bills.map((b) => (
                    <Pressable key={b.id} onPress={() => setOpenBill(b)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontWeight: '700', fontSize: 13, color: b.cancelledAt ? colors.inkFaint : colors.ink }}>
                            {b.number} · {displayPartyName(b.partyId)}
                          </Text>
                          {b.cancelledAt ? <Badge label={t('reports.cancelled')} tone="danger" /> : null}
                        </View>
                        <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>
                          {formatDateTime(b.createdAt)} · {paymentModeLabel(b.paymentMode)}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '700', color: b.cancelledAt ? colors.inkFaint : colors.ink, textDecorationLine: b.cancelledAt ? 'line-through' : 'none' }}>
                        {formatMoney(b.total)} ›
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Card>
            </View>

            <Card style={{ padding: 18, marginBottom: space.xl }}>
              <Text style={{ fontWeight: '700', marginBottom: 10 }}>{t('reports.recentPurchases')}</Text>
              {purchases.length === 0 ? (
                <EmptyState label={t('reports.noPurchases')} />
              ) : (
                purchases.map((pu) => {
                  const due = pu.total - pu.paidAmount;
                  return (
                    <View key={pu.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', fontSize: 13 }}>{pu.supplier}</Text>
                        <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>
                          {formatDateTime(pu.createdAt)}
                          {due > 0 ? ` · ${t('reports.dueToSupplier', { amount: formatMoney(due) })}` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '700' }}>
                        {formatMoney(pu.paidAmount)} <Text style={{ color: colors.inkFaint, fontWeight: '500' }}>/ {formatMoney(pu.total)}</Text>
                      </Text>
                    </View>
                  );
                })
              )}
            </Card>
          </View>
      </ScrollView>

      <Sheet
        visible={openBill !== null}
        onClose={() => setOpenBill(null)}
        title={openBill ? `${openBill.number} · ${formatDateTime(openBill.createdAt)}` : ''}
        footer={
          <>
            {openBill && !openBill.cancelledAt ? (
              <AppButton title={t('reports.cancelBill')} variant="danger" onPress={() => setCancelVisible(true)} />
            ) : null}
            <AppButton title={t('common.close')} variant="ghost" onPress={() => setOpenBill(null)} />
            <AppButton title={t('reports.reprint')} onPress={reprint} disabled={!openBillItemsQuery.data || !!openBill?.cancelledAt} />
          </>
        }
      >
        {openBill?.cancelledAt ? (
          <View style={{ backgroundColor: colors.dangerSoft, borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>{t('reports.cancelledAt', { date: formatDateTime(openBill.cancelledAt) })}</Text>
            {openBill.cancelReason ? <Text style={{ color: colors.danger, fontSize: 12.5, marginTop: 2 }}>{t('reports.reason', { reason: openBill.cancelReason })}</Text> : null}
          </View>
        ) : null}
        {openBill ? (
          <BillSummary
            bill={{
              partyName: openBill.partyId ? displayPartyName(openBill.partyId) : null,
              items: openBillDisplayItems,
              subtotal: openBill.subtotal,
              discount: openBill.discount,
              total: openBill.total,
              paidAmount: openBill.paidAmount,
              paymentMode: openBill.paymentMode,
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        visible={cancelVisible}
        onClose={() => setCancelVisible(false)}
        title={openBill ? t('reports.cancelTitle', { number: openBill.number }) : t('reports.cancelTitleGeneric')}
        footer={
          <>
            <AppButton title={t('reports.keepBill')} variant="ghost" onPress={() => setCancelVisible(false)} />
            <AppButton
              title={t('reports.cancelBill')}
              variant="danger"
              disabled={cancelMutation.isPending}
              onPress={() => openBill && cancelMutation.mutate({ billId: openBill.id, reason: cancelReason.trim() || null })}
            />
          </>
        }
      >
        <Text style={{ fontSize: 13, color: colors.inkSoft, marginBottom: 12 }}>
          {openBill && openBill.partyId && openBill.total > openBill.paidAmount
            ? t('reports.cancelBodyUdhar', {
                amount: formatMoney(openBill.total - openBill.paidAmount),
                name: displayPartyName(openBill.partyId),
              })
            : t('reports.cancelBody')}
        </Text>
        {openBill && openBill.paidAmount > 0 ? (
          <Text style={{ fontSize: 13, color: colors.danger, marginBottom: 12 }}>
            {t('reports.returnCash', { amount: formatMoney(openBill.paidAmount) })}
          </Text>
        ) : null}
        <Field label={t('reports.reasonLabel')} value={cancelReason} onChangeText={setCancelReason} placeholder={t('reports.reasonPlaceholder')} />
      </Sheet>
    </Screen>
  );
}

function Stat({ label, value, hint, valueColor }: { label: string; value: string; hint?: string; valueColor?: string }) {
  return (
    <Card style={{ padding: 16, minWidth: 170, flex: 1 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.inkFaint, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: valueColor ?? colors.ink, marginTop: 6 }}>{value}</Text>
      {hint ? <Text style={{ fontSize: 12, color: colors.inkSoft, marginTop: 4 }}>{hint}</Text> : null}
    </Card>
  );
}

function Row({ left, right, bold, color }: { left: string; right: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 13, color: color ?? colors.inkSoft, fontWeight: bold ? '800' : '400' }}>{left}</Text>
      <Text style={{ fontSize: 13, color: color ?? colors.ink, fontWeight: bold ? '800' : '600' }}>{right}</Text>
    </View>
  );
}
