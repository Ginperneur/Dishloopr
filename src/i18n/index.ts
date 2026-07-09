import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import nl from './locales/nl.json';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

const resources = {
  nl: { translation: nl },
  en: { translation: en },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'nl',
    supportedLngs: ['nl', 'en', 'de', 'es', 'fr'],
    interpolation: {
      escapeValue: false,
    },
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
