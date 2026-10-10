import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../theme';
import { formatMoney, formatQty, totalQty } from '../format';
import { useI18n } from '../i18n';
import type { PaymentMode } from '../types/models';

export interface BillSummaryData {
  partyName: string | null;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  paymentMode: PaymentMode;
}

/** Read-only breakdown of a saved bill: who it's for, line items and totals. Names are shown as given (pass display names). */
export function BillSummary({ bill }: { bill: BillSummaryData }) {
  const { t } = useI18n();
  const balanceDue = bill.total - bill.paidAmount;
  return (
    <View style={{ gap: 6 }}>
      <Line left={t('billing.customer')} right={bill.partyName ?? t('common.walkIn')} bold />
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginVertical: 4 }} />
      {bill.items.map((it, i) => (
        <View key={i}>
          <Line left={it.name} right={formatMoney(it.qty * it.price)} />
          <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>
            {formatQty(it.qty)} × {formatMoney(it.price)}
          </Text>
        </View>
      ))}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginVertical: 4 }} />
      <Line left={t('billing.products')} right={String(bill.items.length)} />
      <Line left={t('billing.totalQty')} right={formatQty(totalQty(bill.items))} bold />
      <Line left={t('billing.subtotal')} right={formatMoney(bill.subtotal)} />
      {bill.discount ? <Line left={t('billing.discount')} right={'− ' + formatMoney(bill.discount)} /> : null}
      <Line left={t('billing.total')} right={formatMoney(bill.total)} bold />
      <Line left={t('billing.paidMode', { mode: t(`common.${bill.paymentMode}`) })} right={formatMoney(bill.paidAmount)} />
      {balanceDue > 0 ? <Line left={t('billing.balanceUdhar')} right={formatMoney(balanceDue)} bold color={colors.danger} /> : null}
    </View>
  );
}

function Line({ left, right, bold, color }: { left: string; right: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <Text style={{ flex: 1, fontSize: 13, color: color ?? colors.inkSoft, fontWeight: bold ? '700' : '400' }}>{left}</Text>
      <Text style={{ fontSize: 13, color: color ?? colors.ink, fontWeight: bold ? '800' : '600' }}>{right}</Text>
    </View>
  );
}
