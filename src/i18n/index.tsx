import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getUiPref, setUiPref } from '../db/repositories/settings';
import { common } from './strings/common';
import { billing } from './strings/billing';
import { products } from './strings/products';
import { categories } from './strings/categories';
import { parties } from './strings/parties';
import { stock } from './strings/stock';
import { reports } from './strings/reports';
import { settings } from './strings/settings';

export type Lang = 'en' | 'hi';

const dictionaries = { common, billing, products, categories, parties, stock, reports, settings };
type Dicts = typeof dictionaries;

/** Every valid key, e.g. 'billing.charge' or 'common.cancel'. */
export type TKey = { [N in keyof Dicts]: `${N & string}.${keyof Dicts[N]['en'] & string}` }[keyof Dicts];

function lookup(lang: Lang, key: TKey): string {
  const dot = key.indexOf('.');
  const ns = dictionaries[key.slice(0, dot) as keyof Dicts] as { en: Record<string, string>; hi: Record<string, string> };
  const name = key.slice(dot + 1);
  return ns[lang][name] ?? ns.en[name] ?? key;
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** UI label in the current language. */
  t: (key: TKey, params?: Record<string, string | number>) => string;
  /** Display name for user data: the Hindi name in Hindi mode when one exists, otherwise the English name. */
  n: (entity: { name: string; nameHi?: string | null } | null | undefined) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    getUiPref('language')
      .then((v) => {
        if (v === 'en' || v === 'hi') setLangState(v);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setUiPref('language', next).catch(() => {});
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, params) => interpolate(lookup(lang, key), params),
      n: (entity) => (entity ? (lang === 'hi' && entity.nameHi ? entity.nameHi : entity.name) : ''),
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider');
  return ctx;
}
