import { t } from '../i18n.js';

export function initI18n(doc: Document) {
  doc.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    if (key) {
      const translation = t(key);
      if (translation !== key) {
        element.prepend(translation);
      }
    }
  });

  doc.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(element => {
    const key = element.dataset.i18nTitle;
    if (key) {
      const translation = t(key);
      if (translation !== key) {
        element.title = translation;
      }
    }
  });
}
