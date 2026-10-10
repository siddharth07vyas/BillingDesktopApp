import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, space } from '../theme';
import { useScreenSize } from './useScreenSize';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { compact, short } = useScreenSize();
  // No navigation header, so keep content clear of the status bar / camera cutout ourselves.
  const insets = useSafeAreaInsets();
  const pad = compact || short ? space.sm : space.lg;
  return (
    <View style={[styles.screen, { padding: pad, paddingTop: insets.top + pad, paddingLeft: insets.left + pad, paddingRight: insets.right + pad }, style]}>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'danger';

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'accent' && { backgroundColor: colors.accent },
        variant === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
        variant === 'danger' && { backgroundColor: colors.dangerSoft },
        small && styles.btnSmall,
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          (variant === 'primary' || variant === 'accent') && { color: variant === 'primary' ? colors.primaryInk : colors.accentInk },
          variant === 'ghost' && { color: colors.ink },
          variant === 'danger' && { color: colors.danger },
          small && styles.btnTextSmall,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ alignItems: 'center' }}>
      {children}
    </ScrollView>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'danger' | 'success' | 'muted' }) {
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'success' ? colors.successSoft : colors.surface3;
  const fg = tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.inkSoft;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Field({
  label,
  hint,
  ...inputProps
}: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkFaint}
        style={styles.input}
        {...inputProps}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBox}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        style={styles.searchInput}
      />
    </View>
  );
}

export function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={[styles.sheet, wide && styles.sheetWide]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Text style={{ fontSize: 16, color: colors.inkSoft }}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={styles.sheetFoot}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export function NumericKeypad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const press = (key: string) => {
    if (key === 'C') onChange('');
    else if (key === '⌫') onChange(value.slice(0, -1));
    else onChange((value === '0' ? '' : value) + key);
  };
  return (
    <View style={styles.keypad}>
      {KEYS.map((k) => (
        <Pressable key={k} onPress={() => press(k)} style={styles.keypadBtn}>
          <Text style={styles.keypadBtnText}>{k}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: space.sm },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.inkFaint, textAlign: 'center' },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 7 },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontWeight: '700', fontSize: 13.5 },
  btnTextSmall: { fontSize: 12 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: space.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  chipTextActive: { color: colors.primaryInk },
  chipRow: { marginBottom: space.md, flexGrow: 0, flexShrink: 0 },
  badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  field: { marginBottom: space.md },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 5 },
  hint: { fontSize: 11, color: colors.inkFaint, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  searchBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flex: 1,
    maxWidth: 360,
  },
  searchInput: { paddingVertical: 10, fontSize: 14, color: colors.ink },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(20,24,19,0.5)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, width: '100%', maxWidth: 440, maxHeight: '94%', overflow: 'hidden' },
  sheetWide: { maxWidth: 620 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: 18, flexGrow: 0, flexShrink: 1 },
  sheetFoot: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  keypadBtn: {
    width: '30%',
    paddingVertical: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
  },
  keypadBtnText: { fontSize: 18, fontWeight: '700', color: colors.ink },
});
