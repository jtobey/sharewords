import { t } from '../game/i18n.js';

export function initI18n(doc: Document) {
  const elements = doc.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      const translation = t(key);
      if (translation !== key) {
        element.textContent = translation;
      }
    }
  });
}
