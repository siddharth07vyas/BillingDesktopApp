import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCategory,
  addSubcategory,
  deleteCategory,
  deleteSubcategory,
  listCategories,
  listSubcategories,
  moveCategory,
  renameCategory,
  renameSubcategory,
} from '../db/repositories/categories';
import { listProducts as listAllProducts } from '../db/repositories/products';
import { AppButton, Card, EmptyState, Field, Screen, SearchField, Sheet } from '../components/ui';
import { HindiNameField } from '../components/HindiNameField';
import { colors, space } from '../theme';
import type { Category, Subcategory } from '../types/models';
import { useI18n } from '../i18n';

type ModalState =
  | { kind: 'addCategory' }
  | { kind: 'renameCategory'; category: Category }
  | { kind: 'addSubcategory'; categoryId: number }
  | { kind: 'renameSubcategory'; subcategory: Subcategory }
  | null;

export default function CategoriesScreen() {
  const { t, n } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [inputValue, setInputValue] = useState('');
  const [hiValue, setHiValue] = useState('');

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const subcategoriesQuery = useQuery({ queryKey: ['subcategories'], queryFn: () => listSubcategories() });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listAllProducts });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['subcategories'] });
  };

  const addCategoryMutation = useMutation({
    mutationFn: (args: { name: string; nameHi: string | null }) => addCategory(args.name, args.nameHi),
    onSuccess: invalidate,
  });
  const renameCategoryMutation = useMutation({
    mutationFn: (args: { id: number; name: string; nameHi: string | null }) => renameCategory(args.id, args.name, args.nameHi),
    onSuccess: invalidate,
  });
  const deleteCategoryMutation = useMutation({ mutationFn: deleteCategory, onSuccess: invalidate });
  const moveCategoryMutation = useMutation({
    mutationFn: (args: { id: number; direction: -1 | 1 }) => moveCategory(args.id, args.direction),
    onSuccess: invalidate,
  });
  const addSubcategoryMutation = useMutation({
    mutationFn: (args: { categoryId: number; name: string; nameHi: string | null }) =>
      addSubcategory(args.categoryId, args.name, args.nameHi),
    onSuccess: invalidate,
  });
  const renameSubcategoryMutation = useMutation({
    mutationFn: (args: { id: number; name: string; nameHi: string | null }) =>
      renameSubcategory(args.id, args.name, args.nameHi),
    onSuccess: invalidate,
  });
  const deleteSubcategoryMutation = useMutation({ mutationFn: deleteSubcategory, onSuccess: invalidate });

  const categories = categoriesQuery.data ?? [];
  const subcategories = subcategoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.nameHi ?? '').toLowerCase().includes(term) ||
        subcategories.some(
          (s) =>
            s.categoryId === c.id &&
            (s.name.toLowerCase().includes(term) || (s.nameHi ?? '').toLowerCase().includes(term))
        )
    );
  }, [categories, subcategories, search]);

  const confirmDeleteCategory = (category: Category) => {
    const hasProducts = products.some((p) => p.categoryId === category.id);
    if (hasProducts) {
      Alert.alert(t('categories.cannotDelete'), t('categories.cannotDeleteBody'));
      return;
    }
    Alert.alert(t('categories.deleteCategory'), t('categories.deleteConfirm', { name: n(category) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCategoryMutation.mutate(category.id) },
    ]);
  };

  const confirmDeleteSubcategory = (sub: Subcategory) => {
    const hasProducts = products.some((p) => p.subcategoryId === sub.id);
    if (hasProducts) {
      Alert.alert(t('categories.cannotDelete'), t('categories.cannotDeleteBody'));
      return;
    }
    Alert.alert(t('categories.deleteSubcategory'), t('categories.deleteConfirm', { name: n(sub) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteSubcategoryMutation.mutate(sub.id) },
    ]);
  };

  const submitModal = () => {
    const name = inputValue.trim();
    if (!name || !modal) return;
    const nameHi = hiValue.trim() || null;
    if (modal.kind === 'addCategory') addCategoryMutation.mutate({ name, nameHi });
    if (modal.kind === 'renameCategory') renameCategoryMutation.mutate({ id: modal.category.id, name, nameHi });
    if (modal.kind === 'addSubcategory') addSubcategoryMutation.mutate({ categoryId: modal.categoryId, name, nameHi });
    if (modal.kind === 'renameSubcategory') renameSubcategoryMutation.mutate({ id: modal.subcategory.id, name, nameHi });
    setModal(null);
    setInputValue('');
    setHiValue('');
  };

  const openModal = (next: ModalState, initial = '', initialHi = '') => {
    setInputValue(initial);
    setHiValue(initialHi);
    setModal(next);
  };

  const renderCategory = ({ item, index }: { item: Category; index: number }) => {
    const subs = subcategories.filter((s) => s.categoryId === item.id);
    const productCount = products.filter((p) => p.categoryId === item.id).length;
    return (
      <Card style={{ padding: 14, marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink }}>{n(item)}</Text>
            <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>
              {t('categories.productCount', { count: productCount })}
              {subs.length ? ` · ${t('categories.subcategoryCount', { count: subs.length })}` : ''}
            </Text>
          </View>
          <Pressable
            disabled={index === 0}
            onPress={() => moveCategoryMutation.mutate({ id: item.id, direction: -1 })}
            style={{ padding: 6, opacity: index === 0 ? 0.3 : 1 }}
          >
            <Text>↑</Text>
          </Pressable>
          <Pressable
            disabled={index === categories.length - 1}
            onPress={() => moveCategoryMutation.mutate({ id: item.id, direction: 1 })}
            style={{ padding: 6, opacity: index === categories.length - 1 ? 0.3 : 1 }}
          >
            <Text>↓</Text>
          </Pressable>
          <Pressable onPress={() => openModal({ kind: 'renameCategory', category: item }, item.name, item.nameHi ?? '')} style={{ padding: 6 }}>
            <Text>✎</Text>
          </Pressable>
          <Pressable onPress={() => confirmDeleteCategory(item)} style={{ padding: 6 }}>
            <Text style={{ color: colors.danger }}>🗑</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          {subs.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, gap: 8 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.inkSoft }}>{n(s)}</Text>
              <Pressable onPress={() => openModal({ kind: 'renameSubcategory', subcategory: s }, s.name, s.nameHi ?? '')}>
                <Text style={{ fontSize: 12 }}>✎</Text>
              </Pressable>
              <Pressable onPress={() => confirmDeleteSubcategory(s)}>
                <Text style={{ fontSize: 12, color: colors.danger }}>🗑</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() => openModal({ kind: 'addSubcategory', categoryId: item.id })}
            style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.inkSoft }}>{t('categories.addSubcategoryButton')}</Text>
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'center' }}>
        <SearchField value={search} onChangeText={setSearch} placeholder={t('categories.searchPlaceholder')} />
        <AppButton title={t('categories.addCategoryButton')} onPress={() => openModal({ kind: 'addCategory' })} />
      </View>
      <Text style={{ fontSize: 12, color: colors.inkFaint, marginBottom: 12 }}>
        {t('categories.hint')}
      </Text>
      <FlatList
        data={filtered}
        keyExtractor={(c) => String(c.id)}
        renderItem={renderCategory}
        ListEmptyComponent={<EmptyState label={t('categories.noMatch')} />}
      />

      <Sheet
        visible={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal?.kind === 'addCategory'
            ? t('categories.addCategory')
            : modal?.kind === 'renameCategory'
            ? t('categories.renameCategory')
            : modal?.kind === 'addSubcategory'
            ? t('categories.addSubcategory')
            : t('categories.renameSubcategory')
        }
        footer={
          <>
            <AppButton title={t('common.cancel')} variant="ghost" onPress={() => setModal(null)} />
            <AppButton title={t('common.save')} onPress={submitModal} />
          </>
        }
      >
        <Field label={t('common.name')} value={inputValue} onChangeText={setInputValue} placeholder={t('categories.namePlaceholder')} autoFocus />
        {modal ? <HindiNameField englishName={inputValue} value={hiValue} onChange={setHiValue} /> : null}
      </Sheet>
    </Screen>
  );
}
