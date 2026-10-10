import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Field } from './ui';
import { colors } from '../theme';
import { useI18n } from '../i18n';
import { suggestHindiName, translationSupported } from '../i18n/translate';

/**
 * Hindi name input for any user-named record. While the user hasn't typed in it themselves, it
 * follows the English name: each change is re-translated on the device after a short pause.
 */
export function HindiNameField({
  englishName,
  value,
  onChange,
}: {
  englishName: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Treat a pre-filled Hindi name (editing an existing record) as user-owned until the English name changes.
  const userEdited = useRef(false);
  const lastEnglish = useRef(englishName);

  const run = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    const hi = await suggestHindiName(text);
    setBusy(false);
    setFailed(hi === null);
    if (hi !== null) onChange(hi);
  };

  useEffect(() => {
    if (englishName === lastEnglish.current) return;
    lastEnglish.current = englishName;
    if (userEdited.current || !translationSupported) return;
    if (!englishName.trim()) {
      onChange('');
      return;
    }
    const timer = setTimeout(() => run(englishName), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [englishName]);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label={t('common.hindiName')}
            value={value}
            onChangeText={(v) => {
              userEdited.current = v.length > 0;
              onChange(v);
            }}
            placeholder={busy ? t('common.translating') : ''}
          />
        </View>
        {translationSupported ? (
          <Pressable
            onPress={() => {
              userEdited.current = false;
              run(englishName);
            }}
            disabled={busy || !englishName.trim()}
            style={{ marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, opacity: busy || !englishName.trim() ? 0.5 : 1 }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.primary }}>{busy ? t('common.translating') : t('common.translate')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ fontSize: 11, color: failed ? colors.danger : colors.inkFaint, marginTop: -8, marginBottom: 12 }}>
        {failed ? t('common.translateFailed') : t('common.hindiNameHint')}
      </Text>
    </View>
  );
}
