import { readFileSync } from 'node:fs'

let translations: any = {};

export async function loadTranslations(lang: string) {
    const fallbackLang = 'en';
    let langToLoad = lang;

    try {
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
            const response = await fetch(`game/i18n/${langToLoad}.json`);
            if (!response.ok) {
                console.warn(`Language '${lang}' not supported. Falling back to English.`);
                langToLoad = fallbackLang;
                const fallbackResponse = await fetch(`game/i18n/${langToLoad}.json`);
                if (!fallbackResponse.ok) {
                    throw new Error(`Failed to load fallback translations for ${langToLoad}`);
                }
                translations = await fallbackResponse.json();
            } else {
                translations = await response.json();
            }
        } else {
            const path = `game/i18n/${langToLoad}.json`;
            try {
                const data = readFileSync(path, 'utf-8');
                translations = JSON.parse(data);
            } catch (error) {
                console.warn(`Language '${lang}' not supported. Falling back to English.`);
                langToLoad = fallbackLang;
                const fallbackPath = `game/i18n/${langToLoad}.json`;
                const data = readFileSync(fallbackPath, 'utf-8');
                translations = JSON.parse(data);
            }
        }
    } catch (error) {
        console.error(error);
        // In case of a network error or other issue, load empty translations
        translations = {};
    }
}

export function t(key: string, params?: Record<string, any>): string {
  const keys = key.split('.');
  let value = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return the key itself if not found
    }
  }

  if (typeof value === 'string') {
    if (params) {
      return value.replace(/\$\{(\w+)\}/g, (_, placeholder) => {
        return params[placeholder] !== undefined ? String(params[placeholder]) : `{${placeholder}}`;
      });
    }
    return value;
  }

  return key; // Return the key if the path does not resolve to a string
}
