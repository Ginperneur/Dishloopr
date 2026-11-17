import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import type { BackendModule, ReadCallback } from 'i18next';
import nl from './locales/nl.json';

// Only Dutch ships in the startup bundle; the other locales (~25 KB each)
// are fetched the first time someone switches to them.
const lazyLocales: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en.json'),
  de: () => import('./locales/de.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
};

const lazyLocaleBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language: string, _namespace: string, callback: ReadCallback) {
    const load = lazyLocales[language];
    if (!load) return callback(null, {});
    load()
      .then((mod) => callback(null, mod.default))
      .catch((err) => callback(err, false));
  },
};

i18n
  .use(lazyLocaleBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { nl: { translation: nl } },
    partialBundledLanguages: true,
    fallbackLng: 'nl',
    supportedLngs: ['nl', 'en', 'de', 'es', 'fr'],
    interpolation: {
      escapeValue: false,
    },
    // Render Dutch while another locale loads instead of suspending the tree.
    react: { useSuspense: false },
    detection: {
      // Default to Dutch for all visitors; only override via ?lang= or saved preference.
      order: ['querystring', 'localStorage'],
      lookupQuerystring: 'lang',
      caches: ['localStorage'],
    },
  });

// Keep <html lang="..."> in sync with the active UI locale so screen readers,
// browsers, and translation tools pick up the right language.
const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined' && lng) {
    const base = lng.split('-')[0];
    document.documentElement.lang = base;
  }
};
syncHtmlLang(i18n.language || i18n.resolvedLanguage || 'nl');
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
