import React, { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addLedgerEntry, addParty, listLedgerForParty, listParties } from '../db/repositories/parties';
import { AppButton, Card, EmptyState, Field, NumericKeypad, Screen, Sheet } from '../components/ui';
import { colors, space } from '../theme';
import { formatDateTime, formatMoney } from '../format';
import { HindiNameField } from '../components/HindiNameField';
import { useI18n } from '../i18n';
import type { Party } from '../types/models';

const MANUAL_UDHAR_NOTE = 'Manual udhar';

export default function PartiesScreen() {
  const queryClient = useQueryClient();
  const { t, n } = useI18n();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addPartyVisible, setAddPartyVisible] = useState(false);
  const [newParty, setNewParty] = useState({ name: '', nameHi: '', phone: '', address: '', openingBalance: '0' });
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [udharVisible, setUdharVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: listParties });
  const parties = partiesQuery.data ?? [];
  const selected = parties.find((p) => p.id === selectedId) ?? null;

  const ledgerQuery = useQuery({
    queryKey: ['ledger', selectedId],
    queryFn: () => listLedgerForParty(selectedId as number),
    enabled: selectedId !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['parties'] });
    queryClient.invalidateQueries({ queryKey: ['ledger', selectedId] });
  };

  const addPartyMutation = useMutation({ mutationFn: addParty, onSuccess: invalidate });
  const ledgerMutation = useMutation({
    mutationFn: (args: { partyId: number; type: 'manual' | 'payment'; amount: number; note: string | null }) =>
      addLedgerEntry(args.partyId, args.type, args.amount, args.note),
    onSuccess: invalidate,
  });

  const submitParty = () => {
    if (!newParty.name.trim()) {
      Alert.alert(t('common.nameRequired'));
      return;
    }
    addPartyMutation.mutate({
      name: newParty.name.trim(),
      nameHi: newParty.nameHi.trim() || null,
      phone: newParty.phone.trim() || null,
      address: newParty.address.trim() || null,
      openingBalance: Number(newParty.openingBalance) || 0,
    });
    setNewParty({ name: '', nameHi: '', phone: '', address: '', openingBalance: '0' });
    setAddPartyVisible(false);
  };

  const submitPayment = () => {
    const value = Number(amount) || 0;
    if (!selected || value <= 0) return;
    ledgerMutation.mutate({ partyId: selected.id, type: 'payment', amount: -value, note: 'Cash received' });
    setAmount('');
    setPaymentVisible(false);
  };

  const submitUdhar = () => {
    const value = Number(amount) || 0;
    if (!selected || value <= 0) return;
    ledgerMutation.mutate({ partyId: selected.id, type: 'manual', amount: value, note: note.trim() || MANUAL_UDHAR_NOTE });
    setAmount('');
    setNote('');
    setUdharVisible(false);
  };

  // The default note is stored in English; show it in the current language.
  const noteLabel = (value: string | null) => (value === MANUAL_UDHAR_NOTE ? t('parties.manualUdhar') : value ?? '');

  const renderParty = ({ item }: { item: Party }) => (
    <Pressable onPress={() => setSelectedId(item.id)}>
      <Card
        style={{
          padding: 14,
          marginBottom: space.sm,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderColor: selectedId === item.id ? colors.primary : colors.border,
        }}
      >
        <View>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{n(item)}</Text>
          <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>{item.phone}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {item.balance > 0 ? (
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkFaint, textTransform: 'uppercase' }}>
              {t('parties.owesYou')}
            </Text>
          ) : null}
          <Text style={{ fontWeight: '800', color: item.balance > 0 ? colors.danger : colors.success }}>
            {item.balance > 0 ? formatMoney(item.balance) : t('parties.settled')}
          </Text>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      <Card style={{ padding: 12, marginBottom: 14 }}>
        <Text style={{ fontSize: 12.5, color: colors.inkSoft }}>
          <Text style={{ fontWeight: '700' }}>{t('parties.introUdhar')}</Text> {t('parties.introBody')}
        </Text>
      </Card>
      <View style={{ flexDirection: 'row', flex: 1, gap: 16 }}>
        <View style={{ flex: 1, maxWidth: 320 }}>
          <AppButton title={t('parties.addPartyButton')} onPress={() => setAddPartyVisible(true)} style={{ marginBottom: 10 }} />
          <FlatList
            data={parties}
            keyExtractor={(p) => String(p.id)}
            renderItem={renderParty}
            ListEmptyComponent={<EmptyState label={t('parties.noParties')} />}
          />
        </View>
        <View style={{ flex: 2 }}>
          {!selected ? (
            <Card style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState label={t('parties.selectParty')} />
            </Card>
          ) : (
            <>
              <Card style={{ padding: 18, marginBottom: 14 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{n(selected)}</Text>
                <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginTop: 4 }}>
                  {selected.phone} · {selected.address}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkFaint, textTransform: 'uppercase', marginTop: 12 }}>
                  {selected.balance > 0 ? t('parties.udharDue') : t('parties.noUdharDue')}
                </Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: selected.balance > 0 ? colors.danger : colors.success }}>
                  {selected.balance > 0 ? formatMoney(selected.balance) : t('parties.settledUp')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <AppButton title={t('parties.addUdharButton')} variant="ghost" small onPress={() => setUdharVisible(true)} />
                  <AppButton title={t('parties.recordPayment')} variant="accent" small disabled={selected.balance <= 0} onPress={() => setPaymentVisible(true)} />
                </View>
              </Card>
              <Card style={{ padding: 16, flex: 1 }}>
                <Text style={{ fontWeight: '700', marginBottom: 10 }}>{t('parties.ledger')}</Text>
                <FlatList
                  data={ledgerQuery.data ?? []}
                  keyExtractor={(e) => String(e.id)}
                  ListEmptyComponent={<EmptyState label={t('parties.noTransactions')} />}
                  renderItem={({ item: e }) => (
                    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 5, backgroundColor: e.type === 'payment' ? colors.success : colors.danger }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 13.5 }}>
                          {e.type === 'payment'
                            ? t('parties.paymentReceived')
                            : e.type === 'manual'
                              ? t(e.amount < 0 ? 'parties.udharReversed' : 'parties.udharAdded', { note: noteLabel(e.note) })
                              : t('parties.udharGivenBill', { note: e.note ?? '' })}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>
                          {t('parties.balanceAfter', { date: formatDateTime(e.createdAt), amount: formatMoney(e.balanceAfter) })}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '700', color: e.amount > 0 ? colors.danger : colors.success }}>
                        {e.amount > 0 ? '+ ' + formatMoney(e.amount) : '− ' + formatMoney(Math.abs(e.amount))}
                      </Text>
                    </View>
                  )}
                />
              </Card>
            </>
          )}
        </View>
      </View>

      <Sheet
        visible={addPartyVisible}
        onClose={() => setAddPartyVisible(false)}
        title={t('parties.addParty')}
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setAddPartyVisible(false)} />
            <AppButton title={t('parties.addParty')} onPress={submitParty} />
          </>
        }
      >
        <Field label={t('common.name')} value={newParty.name} onChangeText={(v) => setNewParty((p) => ({ ...p, name: v }))} placeholder={t('parties.namePlaceholder')} />
        <HindiNameField englishName={newParty.name} value={newParty.nameHi} onChange={(v) => setNewParty((p) => ({ ...p, nameHi: v }))} />
        <Field label={t('common.phone')} value={newParty.phone} onChangeText={(v) => setNewParty((p) => ({ ...p, phone: v }))} placeholder="98XXXXXXXX" keyboardType="phone-pad" />
        <Field label={t('parties.openingBalance')} value={newParty.openingBalance} onChangeText={(v) => setNewParty((p) => ({ ...p, openingBalance: v }))} keyboardType="numeric" />
        <Field label={t('common.address')} value={newParty.address} onChangeText={(v) => setNewParty((p) => ({ ...p, address: v }))} placeholder={t('common.optional')} />
      </Sheet>

      <Sheet
        visible={paymentVisible}
        onClose={() => setPaymentVisible(false)}
        title={t('parties.recordPaymentTitle', { name: n(selected) })}
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setPaymentVisible(false)} />
            <AppButton title={t('parties.savePayment')} onPress={submitPayment} />
          </>
        }
      >
        <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginBottom: 10 }}>
          {t('parties.outstandingBalance', { amount: selected ? formatMoney(selected.balance) : '' })}
        </Text>
        <Field label={t('parties.amountReceived')} value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <NumericKeypad value={amount} onChange={setAmount} />
      </Sheet>

      <Sheet
        visible={udharVisible}
        onClose={() => setUdharVisible(false)}
        title={t('parties.addUdharTitle', { name: n(selected) })}
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setUdharVisible(false)} />
            <AppButton title={t('parties.addUdhar')} onPress={submitUdhar} />
          </>
        }
      >
        <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginBottom: 10 }}>
          {t('parties.udharHint')}
        </Text>
        <Field label={t('common.amount')} value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <Field label={t('common.note')} value={note} onChangeText={setNote} placeholder={t('parties.notePlaceholder')} />
      </Sheet>
    </Screen>
  );
}
