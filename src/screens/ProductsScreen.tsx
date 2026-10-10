import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCategories, listSubcategories } from '../db/repositories/categories';
import {
  addProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type ProductInput,
} from '../db/repositories/products';
import { AppButton, Badge, Card, EmptyState, Field, Screen, SearchField, Sheet } from '../components/ui';
import { HindiNameField } from '../components/HindiNameField';
import { colors, space } from '../theme';
import { formatMoney } from '../format';
import type { Product } from '../types/models';
import { useI18n } from '../i18n';

const emptyForm: ProductInput = {
  name: '',
  nameHi: null,
  categoryId: 0,
  subcategoryId: null,
  unit: 'pc',
  price: 0,
  costPrice: 0,
  stockQty: 0,
  lowStockThreshold: 0,
  sku: null,
};

export default function ProductsScreen() {
  const { t, n } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<ProductInput>(emptyForm);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const subcategoriesQuery = useQuery({ queryKey: ['subcategories'], queryFn: () => listSubcategories() });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] });
  const addMutation = useMutation({ mutationFn: addProduct, onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: (args: { id: number; input: ProductInput }) => updateProduct(args.id, args.input),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: deleteProduct, onSuccess: invalidate });

  const categories = categoriesQuery.data ?? [];
  const subcategories = subcategoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const visibleSubcategories = useMemo(
    () => (categoryFilter === 'all' ? subcategories : subcategories.filter((s) => s.categoryId === categoryFilter)),
    [subcategories, categoryFilter]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (categoryFilter === 'all' || p.categoryId === categoryFilter) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          (p.nameHi ?? '').toLowerCase().includes(term) ||
          (p.sku ?? '').toLowerCase().includes(term))
    );
  }, [products, search, categoryFilter]);

  const categoryName = (id: number) => {
    const c = categories.find((x) => x.id === id);
    return c ? n(c) : '—';
  };
  const subcategoryName = (id: number | null) => {
    const s = id ? subcategories.find((x) => x.id === id) : undefined;
    return s ? n(s) : '—';
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? 0 });
    setFormVisible(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      nameHi: p.nameHi,
      categoryId: p.categoryId,
      subcategoryId: p.subcategoryId,
      unit: p.unit,
      price: p.price,
      costPrice: p.costPrice,
      stockQty: p.stockQty,
      lowStockThreshold: p.lowStockThreshold,
      sku: p.sku,
    });
    setFormVisible(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      Alert.alert(t('products.nameRequired'));
      return;
    }
    const input: ProductInput = { ...form, nameHi: form.nameHi?.trim() || null };
    if (editing) updateMutation.mutate({ id: editing.id, input });
    else addMutation.mutate(input);
    setFormVisible(false);
  };

  const confirmDelete = (p: Product) => {
    Alert.alert(t('products.deleteTitle'), t('products.deleteConfirm', { name: n(p) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(p.id) },
    ]);
  };

  const renderRow = ({ item }: { item: Product }) => {
    const low = item.stockQty <= item.lowStockThreshold;
    return (
      <Card style={{ padding: 14, marginBottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{n(item)}</Text>
          <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>
            {categoryName(item.categoryId)} · {subcategoryName(item.subcategoryId)} {item.sku ? '· ' + item.sku : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{formatMoney(item.price)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: colors.inkSoft }}>
              {item.stockQty} {item.unit}
            </Text>
            {low ? <Badge label={t('common.low')} tone="danger" /> : null}
          </View>
        </View>
        <Pressable onPress={() => openEdit(item)} style={{ padding: 8 }}>
          <Text>✎</Text>
        </Pressable>
        <Pressable onPress={() => confirmDelete(item)} style={{ padding: 8 }}>
          <Text style={{ color: colors.danger }}>🗑</Text>
        </Pressable>
      </Card>
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchField value={search} onChangeText={setSearch} placeholder={t('products.searchPlaceholder')} />
        <AppButton title={t('products.addProduct')} onPress={openAdd} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <FilterChip label={t('products.allCategories')} active={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
        {categories.map((c) => (
          <FilterChip key={c.id} label={n(c)} active={categoryFilter === c.id} onPress={() => setCategoryFilter(c.id)} />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderRow}
        ListEmptyComponent={<EmptyState label={t('products.noMatch')} />}
      />

      <Sheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editing ? t('products.sheetEdit') : t('products.sheetAdd')}
        wide
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setFormVisible(false)} />
            <AppButton title={editing ? t('common.saveChanges') : t('products.submitAdd')} onPress={save} />
          </>
        }
      >
        <Field label={t('common.name')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder={t('products.namePlaceholder')} />
        {formVisible ? (
          <HindiNameField englishName={form.name} value={form.nameHi ?? ''} onChange={(v) => setForm((f) => ({ ...f, nameHi: v }))} />
        ) : null}
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 6 }}>{t('products.category')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={n(c)}
              active={form.categoryId === c.id}
              onPress={() => setForm((f) => ({ ...f, categoryId: c.id, subcategoryId: null }))}
            />
          ))}
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 6 }}>
          {t('products.subcategoryOptional')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <FilterChip label={t('products.none')} active={form.subcategoryId === null} onPress={() => setForm((f) => ({ ...f, subcategoryId: null }))} />
          {subcategories
            .filter((s) => s.categoryId === form.categoryId)
            .map((s) => (
              <FilterChip
                key={s.id}
                label={n(s)}
                active={form.subcategoryId === s.id}
                onPress={() => setForm((f) => ({ ...f, subcategoryId: s.id }))}
              />
            ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={t('products.unit')} value={form.unit} onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))} placeholder="pc / kg / pouch" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('products.sku')} value={form.sku ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, sku: v || null }))} placeholder={t('common.optional')} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('products.sellingPrice')}
              keyboardType="numeric"
              value={String(form.price)}
              onChangeText={(v) => setForm((f) => ({ ...f, price: Number(v) || 0 }))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('products.costPrice')}
              keyboardType="numeric"
              value={String(form.costPrice)}
              onChangeText={(v) => setForm((f) => ({ ...f, costPrice: Number(v) || 0 }))}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('products.stockQty')}
              keyboardType="numeric"
              value={String(form.stockQty)}
              onChangeText={(v) => setForm((f) => ({ ...f, stockQty: Number(v) || 0 }))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('products.lowStockAt')}
              keyboardType="numeric"
              value={String(form.lowStockThreshold)}
              onChangeText={(v) => setForm((f) => ({ ...f, lowStockThreshold: Number(v) || 0 }))}
            />
          </View>
        </View>
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
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.surface,
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: active ? colors.primaryInk : colors.inkSoft }}>{label}</Text>
    </Pressable>
  );
}
