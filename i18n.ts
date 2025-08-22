import { readFileSync } from 'node:fs'
import ENGLISH_TRANSLATIONS from './i18n/en.json'

const [ DEFAULT_LANG, DEFAULT_TRANSLATIONS ] = ['en', ENGLISH_TRANSLATIONS]

let translations: any = {};

export async function loadTranslations(...languages: string[]) {
  for (const lang of languages) {
    if (lang === DEFAULT_LANG) {
      translations = DEFAULT_TRANSLATIONS
      return
    }

    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        const response = await fetch(`i18n/${lang}.json`);
        if (!response.ok) {
          console.warn(`Language '${lang}' not supported.`);
        } else {
          translations = await response.json();
          return
        }
      } else {
        const path = `i18n/${lang}.json`;
        try {
          const data = readFileSync(path, 'utf-8');
          translations = JSON.parse(data);
          return
        } catch (error) {
          console.warn(`Language '${lang}' not supported.`);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
  console.warn(`Configured languages not supported. Falling back to ${DEFAULT_LANG}.`);
  translations = DEFAULT_TRANSLATIONS
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
