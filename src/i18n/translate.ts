import { requireOptionalNativeModule } from 'expo';

/**
 * English → Hindi using Google ML Kit on the device. The Hindi model (~30 MB) downloads on first use,
 * then translation works offline. The native module rejects concurrent calls, so requests are queued.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

// The library throws at import time when its native code is missing (e.g. an app build made before it was
// added), so check for the native module first and only then load the JS wrapper.
export const translationSupported = requireOptionalNativeModule('ExpoTranslateText') != null;

function loadTranslator(): typeof import('expo-translate-text') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-translate-text');
}

/** Translates a batch of names; returns one Hindi string per input, in the same order. Throws if the model can't be used. */
export function translateToHindi(texts: string[]): Promise<string[]> {
  const inputs = texts.map((t) => t.trim());
  if (!inputs.length) return Promise.resolve([]);
  if (!translationSupported) return Promise.reject(new Error('Hindi translation is not available in this app build'));
  return enqueue(async () => {
    // Pass every option explicitly: the library forwards unset options as `undefined`, which the Android
    // side (a Kotlin Map<String, Any>) rejects with "Cannot convert ... value is undefined".
    const result = await loadTranslator().onTranslateTask({
      input: inputs,
      sourceLangCode: 'en',
      targetLangCode: 'hi',
      preferredStrategy: 'lowLatency',
      requiresWifi: false,
      requireCharging: false,
    });
    const out = result.translatedTexts;
    if (Array.isArray(out)) return out.map((s) => String(s).trim());
    if (typeof out === 'string') return [out.trim()];
    throw new Error('Unexpected translation result');
  });
}

/** Single-name convenience wrapper; resolves to null instead of throwing (offline, model missing, etc.). */
export async function suggestHindiName(text: string): Promise<string | null> {
  if (!translationSupported || !text.trim()) return null;
  try {
    const [hi] = await translateToHindi([text]);
    return hi || null;
  } catch {
    return null;
  }
}

/**
 * Downloads the Hindi language pack if it isn't on the device yet. The native module asks ML Kit to
 * download the model once per text in a batch, so a first-ever batch would start many parallel
 * downloads of the same pack; translating one word first makes it a single download.
 */
export async function ensureHindiModel(): Promise<void> {
  await translateToHindi(['shop']);
}

/**
 * Translates many names in chunks, reporting progress; used by "Translate all names".
 * `onChunk` receives each finished chunk so callers can save as they go and keep progress if a later chunk fails.
 */
export async function translateManyToHindi(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
  onChunk?: (start: number, translated: string[]) => Promise<void>
): Promise<string[]> {
  await ensureHindiModel();
  const out: string[] = [];
  const chunk = 25;
  for (let i = 0; i < texts.length; i += chunk) {
    const translated = await translateToHindi(texts.slice(i, i + chunk));
    await onChunk?.(i, translated);
    out.push(...translated);
    onProgress?.(Math.min(i + chunk, texts.length), texts.length);
  }
  return out;
}

/** Short technical reason for a translation failure (ML Kit error code + message), shown alongside the friendly text. */
export function describeTranslationError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  return [e?.code, e?.message].filter(Boolean).join(': ') || String(err);
}
