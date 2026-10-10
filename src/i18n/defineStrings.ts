/**
 * Declares one namespace of UI strings. The Hindi table must have exactly the same keys as the
 * English one, so a missing translation is a type error rather than a blank label.
 * Use `{name}` placeholders for values filled in by `t(key, { name })`.
 */
export function defineStrings<E extends Record<string, string>>(en: E, hi: { [K in keyof E]: string }) {
  return { en, hi };
}
