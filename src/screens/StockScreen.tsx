import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCategories } from '../db/repositories/categories';
import { listProducts } from '../db/repositories/products';
import { adjustStock, listRecentMovements } from '../db/repositories/stock';
import { recordPurchase, type PurchaseLineInput } from '../db/repositories/purchases';
import { AppButton, Card, EmptyState, Field, Screen, SearchField, Sheet } from '../components/ui';
import { colors, space } from '../theme';
import { formatDateTime, formatMoney } from '../format';
import { useI18n, type TKey } from '../i18n';
import type { Product, StockMovementType } from '../types/models';

const MANUAL_ADJUSTMENT_NOTE = 'Manual adjustment';

const MOVEMENT_TYPE_KEYS: Record<StockMovementType, TKey> = {
  sale: 'stock.typeSale',
  purchase: 'stock.typePurchase',
  adjustment: 'stock.typeAdjustment',
  return: 'stock.typeReturn',
};

export default function StockScreen() {
  const queryClient = useQueryClient();
  const { t, n } = useI18n();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [lowOnly, setLowOnly] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('0');
  const [adjustNote, setAdjustNote] = useState('');
  const [purchaseVisible, setPurchaseVisible] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [lines, setLines] = useState<PurchaseLineInput[]>([]);
  const [lineProductId, setLineProductId] = useState<number | null>(null);
  const [lineQty, setLineQty] = useState('1');
  const [lineCost, setLineCost] = useState('');
  const [paidNow, setPaidNow] = useState('');

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const movementsQuery = useQuery({ queryKey: ['movements'], queryFn: () => listRecentMovements(30) });

  const invalidateStock = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['movements'] });
  };
  const adjustMutation = useMutation({
    mutationFn: (args: { productId: number; qtyChange: number; note: string }) =>
      adjustStock(args.productId, args.qtyChange, args.note),
    onSuccess: invalidateStock,
  });
  const purchaseMutation = useMutation({ mutationFn: recordPurchase, onSuccess: invalidateStock });

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const movements = movementsQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!lowOnly || p.stockQty <= p.lowStockThreshold) &&
        (categoryFilter === 'all' || p.categoryId === categoryFilter) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          (p.nameHi ?? '').toLowerCase().includes(term) ||
          (p.sku ?? '').toLowerCase().includes(term))
    );
  }, [products, search, categoryFilter, lowOnly]);

  const productName = (id: number) => {
    const p = products.find((x) => x.id === id);
    return p ? n(p) : '—';
  };
  // The default reason is stored in English; show it in the current language.
  const noteLabel = (value: string | null) => (value === MANUAL_ADJUSTMENT_NOTE ? t('stock.manualAdjustment') : value ?? '');

  const openAdjust = (p: Product) => {
    setAdjustTarget(p);
    setAdjustQty('0');
    setAdjustNote('');
  };
  const submitAdjust = () => {
    const qty = Number(adjustQty) || 0;
    if (!adjustTarget || qty === 0) {
      Alert.alert(t('stock.enterNonZero'));
      return;
    }
    adjustMutation.mutate({ productId: adjustTarget.id, qtyChange: qty, note: adjustNote.trim() || MANUAL_ADJUSTMENT_NOTE });
    setAdjustTarget(null);
  };

  const openPurchase = () => {
    setSupplier('');
    setLines([]);
    setLineProductId(products[0]?.id ?? null);
    setLineQty('1');
    setLineCost(products[0] ? String(products[0].costPrice) : '');
    setPaidNow('');
    setPurchaseVisible(true);
  };
  const selectLineProduct = (id: number) => {
    setLineProductId(id);
    const p = products.find((x) => x.id === id);
    setLineCost(p ? String(p.costPrice) : '');
  };
  const addLine = () => {
    const qty = Number(lineQty) || 0;
    const cost = Number(lineCost) || 0;
    if (!lineProductId || qty <= 0) {
      Alert.alert(t('stock.enterQuantity'));
      return;
    }
    const product = products.find((p) => p.id === lineProductId)!;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === lineProductId);
      if (existing) {
        return prev.map((l) => (l.productId === lineProductId ? { ...l, qty: l.qty + qty, unitCost: cost } : l));
      }
      return [...prev, { productId: product.id, nameSnapshot: product.name, qty, unitCost: cost }];
    });
  };
  const removeLine = (productId: number) => setLines((prev) => prev.filter((l) => l.productId !== productId));
  const purchaseTotal = lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);
  const submitPurchase = () => {
    if (!lines.length) return;
    const paid = Math.max(0, Math.min(purchaseTotal, Number(paidNow) || 0));
    purchaseMutation.mutate({ supplier: supplier.trim() || 'Unnamed supplier', items: lines, paidAmount: paid });
    setPurchaseVisible(false);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchField value={search} onChangeText={setSearch} placeholder={t('stock.searchPlaceholder')} />
        <AppButton
          title={lowOnly ? t('stock.lowStockCount', { count: products.filter((p) => p.stockQty <= p.lowStockThreshold).length }) : t('stock.lowStockOnly')}
          variant={lowOnly ? 'primary' : 'ghost'}
          small
          onPress={() => setLowOnly((v) => !v)}
        />
        <AppButton title={t('stock.recordPurchaseButton')} variant="accent" onPress={openPurchase} />
      </View>

      <View style={{ flexDirection: 'row', flex: 1, gap: 16 }}>
        <View style={{ flex: 1 }}>
          <FlatList
            data={filtered}
            keyExtractor={(p) => String(p.id)}
            ListEmptyComponent={<EmptyState label={t('stock.noProductsMatch')} />}
            renderItem={({ item }) => {
              const low = item.stockQty <= item.lowStockThreshold;
              return (
                <Card style={{ padding: 14, marginBottom: space.sm, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>{n(item)}</Text>
                    <Text style={{ fontSize: 11.5, color: low ? colors.danger : colors.inkSoft }}>
                      {item.stockQty} {item.unit} {low ? `· ${t('common.low')}` : ''}
                    </Text>
                  </View>
                  <AppButton title={t('stock.adjust')} variant="ghost" small onPress={() => openAdjust(item)} />
                </Card>
              );
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Card style={{ padding: 16, flex: 1 }}>
            <Text style={{ fontWeight: '700', marginBottom: 10 }}>{t('stock.recentMovements')}</Text>
            <FlatList
              data={movements}
              keyExtractor={(m) => String(m.id)}
              ListEmptyComponent={<EmptyState label={t('stock.noMovements')} />}
              renderItem={({ item: m }) => (
                <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 5, backgroundColor: m.qtyChange < 0 ? colors.danger : colors.success }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 13 }}>{productName(m.productId)}</Text>
                    <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>
                      {t(MOVEMENT_TYPE_KEYS[m.type])} · {noteLabel(m.note)} · {formatDateTime(m.createdAt)}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '700', color: m.qtyChange < 0 ? colors.danger : colors.success }}>
                    {m.qtyChange > 0 ? '+' : ''}
                    {m.qtyChange}
                  </Text>
                </View>
              )}
            />
          </Card>
        </View>
      </View>

      <Sheet
        visible={adjustTarget !== null}
        onClose={() => setAdjustTarget(null)}
        title={t('stock.adjustTitle', { name: n(adjustTarget) })}
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setAdjustTarget(null)} />
            <AppButton title={t('stock.saveAdjustment')} onPress={submitAdjust} />
          </>
        }
      >
        <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginBottom: 12 }}>
          {t('stock.currentStock', { qty: adjustTarget?.stockQty ?? '', unit: adjustTarget?.unit ?? '' })}
        </Text>
        <Field label={t('stock.changeLabel')} value={adjustQty} onChangeText={setAdjustQty} keyboardType="numbers-and-punctuation" />
        <Field label={t('stock.reason')} value={adjustNote} onChangeText={setAdjustNote} placeholder={t('stock.reasonPlaceholder')} />
      </Sheet>

      <Sheet
        visible={purchaseVisible}
        onClose={() => setPurchaseVisible(false)}
        title={t('stock.purchaseTitle')}
        wide
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setPurchaseVisible(false)} />
            <AppButton title={t('stock.savePurchase')} disabled={!lines.length} onPress={submitPurchase} />
          </>
        }
      >
        <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginBottom: 12 }}>
          {t('stock.purchaseHint')}
        </Text>
        <Field label={t('stock.supplierLabel')} value={supplier} onChangeText={setSupplier} placeholder={t('stock.supplierPlaceholder')} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 6 }}>{t('stock.product')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {products.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => selectLineProduct(p.id)}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: lineProductId === p.id ? colors.primary : colors.border,
                backgroundColor: lineProductId === p.id ? colors.primary : colors.surface,
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: lineProductId === p.id ? colors.primaryInk : colors.inkSoft }}>
                {n(p)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={t('stock.qty')} value={lineQty} onChangeText={setLineQty} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('stock.costPerUnit')} value={lineCost} onChangeText={setLineCost} keyboardType="numeric" />
          </View>
        </View>
        <AppButton title={t('stock.addLine')} variant="ghost" onPress={addLine} style={{ marginBottom: 14 }} />
        {lines.map((l) => (
          <View key={l.productId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{n(products.find((p) => p.id === l.productId)) || l.nameSnapshot}</Text>
              <Text style={{ fontSize: 12, color: colors.inkFaint }}>
                {l.qty} × {formatMoney(l.unitCost)} = {formatMoney(l.qty * l.unitCost)}
              </Text>
            </View>
            <Pressable onPress={() => removeLine(l.productId)}>
              <Text style={{ color: colors.danger }}>🗑</Text>
            </Pressable>
          </View>
        ))}
        {lines.length > 0 ? (
          <>
            <Text style={{ fontWeight: '800', fontSize: 16, marginTop: 12 }}>{t('stock.total', { amount: formatMoney(purchaseTotal) })}</Text>
            <View style={{ marginTop: 10 }}>
              <Field label={t('stock.paidNow')} value={paidNow} onChangeText={setPaidNow} keyboardType="numeric" placeholder={String(purchaseTotal)} />
            </View>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
