import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCategories, listSubcategories } from '../db/repositories/categories';
import { listProducts } from '../db/repositories/products';
import { addParty, listParties } from '../db/repositories/parties';
import { getSettings, getUiPref, setUiPref } from '../db/repositories/settings';
import { chargeBill } from '../db/repositories/bills';
import { clearCartDraft, loadCartDraft, saveCartDraft } from '../db/repositories/cartDraft';
import { AppButton, Badge, Card, EmptyState, Field, NumericKeypad, Screen, SearchField, Sheet } from '../components/ui';
import { colors, space } from '../theme';
import { formatMoney, formatQty, totalQty } from '../format';
import { usePrinter } from '../printer/PrinterContext';
import { BillSummary } from '../components/BillSummary';
import { useScreenSize } from '../components/useScreenSize';
import { useI18n } from '../i18n';
import type { PaymentMode, Product } from '../types/models';

interface CartLine {
  productId: number;
  qty: number;
}

// Names here are English (they go on the printed receipt); ids let the on-screen summary show Hindi names.
interface LastReceipt {
  number: string;
  total: number;
  paidAmount: number;
  paymentMode: PaymentMode;
  partyId: number | null;
  partyName: string | null;
  items: { productId: number; name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
}

export default function BillingScreen() {
  const { t, n } = useI18n();
  const queryClient = useQueryClient();
  const printer = usePrinter();
  const { compact, short } = useScreenSize();
  const cardWidth = compact ? 132 : 160;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gridWidth, setGridWidth] = useState(0);
  const gridColumns = Math.max(1, Math.floor((gridWidth + 10) / (cardWidth + 10)));

  useEffect(() => {
    getUiPref('billingView')
      .then((v) => {
        if (v === 'grid' || v === 'list') setViewMode(v);
      })
      .catch(() => {});
  }, []);
  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    setUiPref('billingView', mode).catch(() => {});
  };

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [subFilter, setSubFilter] = useState<number | 'all'>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [splitCash, setSplitCash] = useState('');
  const [qtyModalProduct, setQtyModalProduct] = useState<Product | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [lastReceipt, setLastReceipt] = useState<LastReceipt | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [newCustomerVisible, setNewCustomerVisible] = useState(false);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  // Restore the in-progress bill so a reload or restart doesn't lose it.
  useEffect(() => {
    loadCartDraft()
      .then((draft) => {
        if (!draft) return;
        setCart(draft.cart);
        setDiscount(draft.discount);
        setPaymentMode(draft.paymentMode);
        setSelectedPartyId(draft.selectedPartyId);
        setSplitCash(draft.splitCash);
      })
      .finally(() => setDraftLoaded(true));
  }, []);

  // Keep the draft in sync; it's only discarded after a successful charge or an explicit clear.
  useEffect(() => {
    if (!draftLoaded) return;
    const save = cart.length
      ? saveCartDraft({ cart, discount, paymentMode, selectedPartyId, splitCash })
      : clearCartDraft();
    save.catch(() => {});
  }, [draftLoaded, cart, discount, paymentMode, selectedPartyId, splitCash]);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const subcategoriesQuery = useQuery({ queryKey: ['subcategories'], queryFn: () => listSubcategories() });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: listParties });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const categories = categoriesQuery.data ?? [];
  const subcategories = subcategoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const parties = partiesQuery.data ?? [];
  const settings = settingsQuery.data;

  const chargeMutation = useMutation({
    mutationFn: chargeBill,
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['recentBills'] });
      queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
      const partyName = variables.partyId ? parties.find((p) => p.id === variables.partyId)?.name ?? null : null;
      const chargedSubtotal = variables.items.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
      resetBill();
      setLastReceipt({
        number: result.number,
        total: result.total,
        paidAmount: variables.paidAmount,
        paymentMode: variables.paymentMode,
        partyId: variables.partyId,
        partyName,
        items: variables.items.map((l) => ({ productId: l.productId, name: l.nameSnapshot, qty: l.qty, price: l.unitPrice })),
        subtotal: chargedSubtotal,
        discount: variables.discount,
      });
    },
    onError: (err: any) => Alert.alert(t('billing.saveFailed'), String(err?.message ?? err)),
  });

  // Quick-add from the bill: the new customer is saved as a party and selected right away.
  const addCustomerMutation = useMutation({
    mutationFn: addParty,
    onSuccess: async (partyId) => {
      await queryClient.invalidateQueries({ queryKey: ['parties'] });
      setSelectedPartyId(partyId);
      setNewCustomer({ name: '', phone: '' });
      setNewCustomerVisible(false);
    },
    onError: (err: any) => Alert.alert(t('billing.customerAddFailed'), String(err?.message ?? err)),
  });
  const submitNewCustomer = () => {
    if (!newCustomer.name.trim()) {
      Alert.alert(t('common.nameRequired'));
      return;
    }
    addCustomerMutation.mutate({ name: newCustomer.name.trim(), nameHi: null, phone: newCustomer.phone.trim() || null, address: null, openingBalance: 0 });
  };

  const activeSubcategories = useMemo(
    () => (categoryFilter === 'all' ? [] : subcategories.filter((s) => s.categoryId === categoryFilter)),
    [subcategories, categoryFilter]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (categoryFilter === 'all' || p.categoryId === categoryFilter) &&
        (subFilter === 'all' || p.subcategoryId === subFilter) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          (p.nameHi ?? '').toLowerCase().includes(term) ||
          (p.sku ?? '').toLowerCase().includes(term))
    );
  }, [products, search, categoryFilter, subFilter]);

  const cartLines = cart.map((c) => ({ ...c, product: products.find((p) => p.id === c.productId)! })).filter((l) => l.product);
  const subtotal = cartLines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const billQty = totalQty(cartLines);
  const discountValue = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);
  const selectedParty = selectedPartyId ? parties.find((p) => p.id === selectedPartyId) ?? null : null;
  const customerTerm = customerSearch.trim().toLowerCase();
  const pickerParties = customerTerm
    ? parties.filter((p) => p.name.toLowerCase().includes(customerTerm) || (p.nameHi ?? '').includes(customerTerm) || (p.phone ?? '').includes(customerTerm))
    : parties;
  const pickCustomer = (partyId: number | null) => {
    setSelectedPartyId(partyId);
    setCustomerPickerVisible(false);
    setCustomerSearch('');
  };

  const resetBill = () => {
    setCart([]);
    setDiscount('');
    setPaymentMode('cash');
    setSelectedPartyId(null);
    setSplitCash('');
  };
  const confirmClearBill = () => {
    Alert.alert(t('billing.clearBillTitle'), t('billing.clearBillBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('billing.clear'), style: 'destructive', onPress: resetBill },
    ]);
  };

  const setQty = (productId: number, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((c) => c.productId !== productId);
      const existing = prev.find((c) => c.productId === productId);
      if (existing) return prev.map((c) => (c.productId === productId ? { ...c, qty } : c));
      return [...prev, { productId, qty }];
    });
  };
  const bump = (productId: number, delta: number) => {
    const existing = cart.find((c) => c.productId === productId);
    setQty(productId, (existing?.qty ?? 0) + delta);
  };

  const openQtyModal = (p: Product) => {
    const existing = cart.find((c) => c.productId === p.id);
    setQtyInput(existing ? String(existing.qty) : '');
    setQtyModalProduct(p);
  };
  const saveQtyModal = () => {
    if (!qtyModalProduct) return;
    setQty(qtyModalProduct.id, Number(qtyInput) || 0);
    setQtyModalProduct(null);
  };

  const paidAmount = paymentMode === 'cash' ? total : paymentMode === 'split' ? Number(splitCash) || 0 : 0;

  // Charge only opens a review; nothing is saved (stock, udhar, today's sales) until the bill is confirmed.
  const charge = () => {
    if (!cartLines.length) return;
    if (paymentMode !== 'cash' && !selectedPartyId) {
      Alert.alert(t('billing.selectParty'));
      return;
    }
    if (paymentMode === 'split' && paidAmount > total) {
      Alert.alert(t('billing.cashMoreThanTotal'));
      return;
    }
    setReviewVisible(true);
  };

  const confirmCharge = () => {
    setReviewVisible(false);
    chargeMutation.mutate({
      partyId: selectedPartyId,
      items: cartLines.map((l) => ({ productId: l.product.id, nameSnapshot: l.product.name, qty: l.qty, unitPrice: l.product.price })),
      discount: discountValue,
      paymentMode,
      paidAmount,
    });
  };

  const printLastReceipt = async () => {
    if (!lastReceipt || !settings) return;
    if (!printer.connectedAddress) {
      Alert.alert(t('common.noPrinterTitle'), t('common.noPrinterBody'));
      return;
    }
    try {
      await printer.printReceipt({
        settings,
        billNumber: lastReceipt.number,
        createdAt: new Date().toISOString(),
        partyName: lastReceipt.partyName,
        items: lastReceipt.items,
        subtotal: lastReceipt.subtotal,
        discount: lastReceipt.discount,
        total: lastReceipt.total,
        paid: lastReceipt.paidAmount,
        paymentMode: lastReceipt.paymentMode,
      });
      Alert.alert(t('common.sent'), t('common.sentTo', { name: printer.connectedName ?? '' }));
    } catch (err: any) {
      Alert.alert(t('common.printFailed'), String(err?.message ?? err));
    }
  };

  // On-screen copy of the saved bill with display (possibly Hindi) names; the printed receipt keeps English.
  const lastReceiptDisplay = lastReceipt
    ? {
        ...lastReceipt,
        partyName: lastReceipt.partyId ? n(parties.find((p) => p.id === lastReceipt.partyId)) || lastReceipt.partyName : null,
        items: lastReceipt.items.map((it) => ({ ...it, name: n(products.find((p) => p.id === it.productId)) || it.name })),
      }
    : null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flex: 1, gap: compact ? 10 : 16 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SearchField value={search} onChangeText={setSearch} placeholder={t('billing.searchPlaceholder')} />
            <View style={styles.viewToggle}>
              {(['grid', 'list'] as const).map((m) => (
                <Pressable key={m} onPress={() => changeViewMode(m)} style={[styles.viewToggleBtn, viewMode === m && { backgroundColor: colors.primary }]}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: viewMode === m ? colors.primaryInk : colors.inkSoft }}>{m === 'grid' ? t('billing.grid') : t('billing.list')}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipScroll, { marginTop: 10, marginBottom: activeSubcategories.length ? 6 : 10 }]} contentContainerStyle={styles.chipScrollContent}>
            <FilterChip
              label={t('billing.allItems')}
              active={categoryFilter === 'all'}
              onPress={() => {
                setCategoryFilter('all');
                setSubFilter('all');
              }}
            />
            {categories.map((c) => (
              <FilterChip
                key={c.id}
                label={n(c)}
                active={categoryFilter === c.id}
                onPress={() => {
                  setCategoryFilter(c.id);
                  setSubFilter('all');
                }}
              />
            ))}
          </ScrollView>
          {activeSubcategories.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipScroll, { marginBottom: 10 }]} contentContainerStyle={styles.chipScrollContent}>
              <FilterChip label={t('billing.allVarieties')} active={subFilter === 'all'} onPress={() => setSubFilter('all')} />
              {activeSubcategories.map((s) => (
                <FilterChip key={s.id} label={n(s)} active={subFilter === s.id} onPress={() => setSubFilter(s.id)} />
              ))}
            </ScrollView>
          ) : null}

          <View style={{ flex: 1 }} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            <FlatList
              key={viewMode === 'grid' ? `grid-${gridColumns}` : 'list'}
              data={filteredProducts}
              extraData={cart}
              keyExtractor={(p) => String(p.id)}
              numColumns={viewMode === 'grid' ? gridColumns : 1}
              columnWrapperStyle={viewMode === 'grid' && gridColumns > 1 ? { gap: 10 } : undefined}
              ItemSeparatorComponent={viewMode === 'grid' ? GridGap : undefined}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={24}
              windowSize={7}
              ListEmptyComponent={<EmptyState label={t('billing.noProducts')} />}
              renderItem={({ item: p }) => {
                const cartQty = cart.find((c) => c.productId === p.id)?.qty ?? 0;
                const low = p.stockQty <= p.lowStockThreshold;
                if (viewMode === 'list') {
                  return (
                    <View style={[styles.listRow, cartQty > 0 && { backgroundColor: colors.primarySoft }]}>
                      <Pressable onPress={() => bump(p.id, 1)} style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                          {n(p)}
                        </Text>
                        <Text style={{ fontSize: 11, color: low ? colors.danger : colors.inkFaint }} numberOfLines={1}>
                          {t('billing.inStock', { qty: p.stockQty, unit: p.unit })}
                          {low ? ` · ${t('common.low')}` : ''}
                        </Text>
                      </Pressable>
                      <Text style={{ fontWeight: '700', color: colors.primary, fontSize: 13 }}>{formatMoney(p.price)}</Text>
                      <QtyControl qty={cartQty} width={110} onDec={() => bump(p.id, -1)} onInc={() => bump(p.id, 1)} onEdit={() => openQtyModal(p)} />
                    </View>
                  );
                }
                const subName = p.subcategoryId ? n(subcategories.find((s) => s.id === p.subcategoryId)) : null;
                return (
                  <Card
                    style={{
                      padding: compact ? 10 : 12,
                      width: cardWidth,
                      borderColor: cartQty > 0 ? colors.primary : colors.border,
                    }}
                  >
                    <Pressable onPress={() => bump(p.id, 1)}>
                      {low ? <Badge label={t('common.low')} tone="danger" /> : null}
                      {subName ? <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkFaint, textTransform: 'uppercase', marginTop: 4 }}>{subName}</Text> : null}
                      <Text style={{ fontWeight: '700', fontSize: 13, marginTop: 4, minHeight: 34 }} numberOfLines={2}>
                        {n(p)}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.inkFaint }}>{t('billing.inStock', { qty: p.stockQty, unit: p.unit })}</Text>
                      <Text style={{ fontWeight: '700', color: colors.primary, marginTop: 4 }}>{formatMoney(p.price)}</Text>
                    </Pressable>
                    <View style={{ marginTop: 8 }}>
                      <QtyControl qty={cartQty} onDec={() => bump(p.id, -1)} onInc={() => bump(p.id, 1)} onEdit={() => openQtyModal(p)} />
                    </View>
                  </Card>
                );
              }}
            />
          </View>
        </View>

        <Card style={{ width: compact ? 290 : 350, padding: 0, overflow: 'hidden' }}>
          {/* One slim line so the item list gets the height; this is the only place item/qty counts are shown. */}
          <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ flex: 1, fontSize: 12, color: colors.inkFaint }} numberOfLines={1}>
              <Text style={{ fontWeight: '700', fontSize: 13.5, color: colors.ink }}>{t('billing.currentBill')}</Text>
              {'  '}
              {selectedParty ? n(selectedParty) : t('common.walkIn')} ·{' '}
              {t(cartLines.length === 1 ? 'billing.itemCountOne' : 'billing.itemCountMany', { count: cartLines.length })} ·{' '}
              <Text style={{ fontWeight: '700', color: colors.ink }}>{t('billing.qtyCount', { qty: formatQty(billQty) })}</Text>
            </Text>
            {cartLines.length ? (
              <Pressable onPress={confirmClearBill} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.danger }}>{t('billing.clearBill')}</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
            {cartLines.length === 0 ? (
              <EmptyState label={t('billing.cartEmpty')} />
            ) : (
              cartLines.map((l) => (
                <View key={l.productId} style={{ gap: 6, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ flex: 1, fontWeight: '600', fontSize: 13 }}>{n(l.product)}</Text>
                    <Text style={{ fontWeight: '800', fontSize: 13 }}>{formatMoney(l.product.price * l.qty)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <QtyControl qty={l.qty} width={100} onDec={() => bump(l.productId, -1)} onInc={() => bump(l.productId, 1)} onEdit={() => openQtyModal(l.product)} />
                    <Text style={{ flex: 1, fontSize: 11.5, color: colors.inkFaint }} numberOfLines={1}>
                      {l.product.unit} × {formatMoney(l.product.price)}
                    </Text>
                    <Pressable onPress={() => setQty(l.productId, 0)} style={{ padding: 6 }}>
                      <Text style={{ color: colors.danger }}>🗑</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
            <View style={{ gap: 8, marginTop: 12 }}>
              <Field label={t('billing.discountField')} value={discount} onChangeText={setDiscount} keyboardType="numeric" placeholder="0" />
              <SummaryRow label={t('billing.subtotal')} value={formatMoney(subtotal)} />
              {discountValue ? <SummaryRow label={t('billing.discount')} value={'− ' + formatMoney(discountValue)} /> : null}
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginTop: 4 }}>{t('billing.payment')}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['cash', 'udhar', 'split'] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setPaymentMode(m)}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: paymentMode === m ? colors.primary : colors.border, backgroundColor: paymentMode === m ? colors.primary : colors.surface }}
                  >
                    <Text style={{ color: paymentMode === m ? colors.primaryInk : colors.inkSoft, fontWeight: '600', fontSize: 13 }}>
                      {t(`common.${m}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft }}>
                {paymentMode === 'cash' ? t('billing.customerOptional') : t('billing.customerRequired')}
              </Text>
              <Pressable onPress={() => setCustomerPickerVisible(true)} style={styles.dropdown}>
                <Text style={{ flex: 1, fontSize: 14, color: selectedParty || paymentMode === 'cash' ? colors.ink : colors.inkFaint }} numberOfLines={1}>
                  {selectedParty ? n(selectedParty) : paymentMode === 'cash' ? t('common.walkIn') : t('billing.selectCustomer')}
                </Text>
                <Text style={{ color: colors.inkSoft, fontSize: 12 }}>▼</Text>
              </Pressable>
              {paymentMode === 'split' ? (
                <Field label={t('billing.cashReceivedNow')} value={splitCash} onChangeText={setSplitCash} keyboardType="numeric" />
              ) : null}
            </View>
          </ScrollView>
          <View style={{ paddingVertical: short ? 8 : 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, color: colors.inkSoft }}>{t('billing.total')}</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }} numberOfLines={1}>
                {formatMoney(total)}
              </Text>
            </View>
            <AppButton
              title={t('billing.charge', { amount: '' }).trim()}
              variant="accent"
              disabled={cartLines.length === 0 || chargeMutation.isPending}
              onPress={charge}
              style={{ paddingHorizontal: 22 }}
            />
          </View>
        </Card>
      </View>

      <Sheet
        visible={qtyModalProduct !== null}
        onClose={() => setQtyModalProduct(null)}
        title={n(qtyModalProduct)}
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setQtyModalProduct(null)} />
            <AppButton title={t('billing.setQuantity')} onPress={saveQtyModal} />
          </>
        }
      >
        {qtyModalProduct ? (
          <>
            <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginBottom: 10 }}>
              {t('billing.pricePerUnit', { price: formatMoney(qtyModalProduct.price), unit: qtyModalProduct.unit })} ·{' '}
              {t('billing.inStock', { qty: qtyModalProduct.stockQty, unit: qtyModalProduct.unit })}
            </Text>
            <Field label={t('billing.quantityField', { unit: qtyModalProduct.unit })} value={qtyInput} onChangeText={setQtyInput} keyboardType="numeric" placeholder="0" autoFocus />
            <NumericKeypad value={qtyInput} onChange={setQtyInput} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={customerPickerVisible} onClose={() => pickCustomer(selectedPartyId)} title={t('billing.selectCustomer')}>
        <SearchField value={customerSearch} onChangeText={setCustomerSearch} placeholder={t('billing.searchCustomers')} />
        <Pressable
          onPress={() => {
            setCustomerPickerVisible(false);
            setCustomerSearch('');
            setNewCustomerVisible(true);
          }}
          style={styles.pickerRow}
        >
          <Text style={{ fontWeight: '700', color: colors.primary }}>{t('billing.newCustomerChip')}</Text>
        </Pressable>
        {paymentMode === 'cash' && !customerTerm ? (
          <Pressable onPress={() => pickCustomer(null)} style={[styles.pickerRow, selectedPartyId === null && { backgroundColor: colors.primarySoft }]}>
            <Text style={{ flex: 1 }}>{t('common.walkIn')}</Text>
          </Pressable>
        ) : null}
        {pickerParties.map((p) => (
          <Pressable key={p.id} onPress={() => pickCustomer(p.id)} style={[styles.pickerRow, selectedPartyId === p.id && { backgroundColor: colors.primarySoft }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{n(p)}</Text>
              {p.phone ? <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>{p.phone}</Text> : null}
            </View>
            {p.balance > 0 ? <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>{t('billing.owes', { amount: formatMoney(p.balance) })}</Text> : null}
          </Pressable>
        ))}
        {pickerParties.length === 0 ? <EmptyState label={t('billing.noCustomers')} /> : null}
      </Sheet>

      <Sheet
        visible={newCustomerVisible}
        onClose={() => setNewCustomerVisible(false)}
        title={t('billing.newCustomerTitle')}
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setNewCustomerVisible(false)} />
            <AppButton title={t('billing.addAndSelect')} onPress={submitNewCustomer} disabled={addCustomerMutation.isPending} />
          </>
        }
      >
        <Field label={t('common.name')} value={newCustomer.name} onChangeText={(v) => setNewCustomer((c) => ({ ...c, name: v }))} placeholder={t('parties.namePlaceholder')} autoFocus />
        <Field label={t('common.phone')} value={newCustomer.phone} onChangeText={(v) => setNewCustomer((c) => ({ ...c, phone: v }))} placeholder={t('common.optional')} keyboardType="phone-pad" />
        <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginTop: 8 }}>{t('billing.newCustomerHint')}</Text>
      </Sheet>

      <Sheet
        visible={reviewVisible}
        onClose={() => setReviewVisible(false)}
        title={t('billing.reviewBill')}
        footer={
          <>
            <AppButton title={t('billing.backToEdit')} variant="ghost" onPress={() => setReviewVisible(false)} />
            <AppButton title={t('billing.confirmSave', { amount: formatMoney(total) })} variant="accent" onPress={confirmCharge} disabled={chargeMutation.isPending} />
          </>
        }
      >
        <BillSummary
          bill={{
            partyName: selectedParty ? n(selectedParty) : null,
            items: cartLines.map((l) => ({ name: n(l.product), qty: l.qty, price: l.product.price })),
            subtotal,
            discount: discountValue,
            total,
            paidAmount,
            paymentMode,
          }}
        />
        <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginTop: 12 }}>
          {t('billing.notSavedYet')}
        </Text>
      </Sheet>

      <Sheet
        visible={lastReceipt !== null}
        onClose={() => setLastReceipt(null)}
        title={t('billing.billSaved', { number: lastReceipt?.number ?? '' })}
        footer={
          <>
            <AppButton title={t('billing.newBill')} variant="ghost" onPress={() => setLastReceipt(null)} />
            <AppButton title={t('billing.print')} onPress={printLastReceipt} />
          </>
        }
      >
        {lastReceiptDisplay ? <BillSummary bill={lastReceiptDisplay} /> : null}
        <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginTop: 12 }}>
          {t('billing.savedHint')}
        </Text>
        <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginTop: 4 }}>
          {printer.connectedName ? t('billing.printerReady', { name: printer.connectedName }) : t('billing.noPrinterHint')}
        </Text>
      </Sheet>
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: 999,
        borderWidth: 1,
        marginRight: space.sm,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.surface,
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: active ? colors.primaryInk : colors.inkSoft }}>{label}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: bold ? 16 : 13, color: bold ? colors.ink : colors.inkSoft, fontWeight: bold ? '800' : '400' }}>{label}</Text>
      <Text style={{ fontSize: bold ? 16 : 13, color: colors.ink, fontWeight: bold ? '800' : '600' }}>{value}</Text>
    </View>
  );
}

function QtyControl({ qty, width, onDec, onInc, onEdit }: { qty: number; width?: number; onDec: () => void; onInc: () => void; onEdit: () => void }) {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', width, height: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' }}>
      <Pressable onPress={onDec} style={{ width: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 }}>
        <Text style={{ fontWeight: '700' }}>−</Text>
      </Pressable>
      <Pressable onPress={onEdit} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: qty > 0 ? colors.primarySoft : colors.surface }}>
        <Text style={{ fontWeight: '800', color: qty > 0 ? colors.primary : colors.ink }}>{qty > 0 ? formatQty(qty) : t('common.add')}</Text>
      </Pressable>
      <Pressable onPress={onInc} style={{ width: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 }}>
        <Text style={{ fontWeight: '700' }}>+</Text>
      </Pressable>
    </View>
  );
}

function GridGap() {
  return <View style={{ height: 10 }} />;
}

const styles = StyleSheet.create({
  // ScrollView grows by default; without this a horizontal chip row stretches to half the screen height
  // and the pill-shaped chips render as tall circles.
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipScrollContent: { alignItems: 'center' },
  viewToggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
  viewToggleBtn: { paddingVertical: 9, paddingHorizontal: 12 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
});
