import * as i18nextNs from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

// Federation interop: the shared i18next arrives as the module *namespace*, which lacks
// instance methods like addResourceBundle()/isInitialized; normalize to the real instance.
const i18n = ((i18nextNs as unknown as { default?: typeof import('i18next').default }).default
  ?? (i18nextNs as unknown as typeof import('i18next').default));

// ---------------------------------------------------------------------------
// i18next instance.
//
// SHARED-SINGLETON CONTRACT: `i18next` and `react-i18next` are federation
// singletons. When embedded, the SHELL initialises i18next first; importing
// this module then only ADDS our resource bundles (under the `payments`
// namespace) to the already-running instance. We must NOT re-init if the
// shell already did, or we would clobber the shell's language/config.
//
// Standalone, the shell isn't there, so we init here with en/hi/mr.
// ---------------------------------------------------------------------------

const NS = 'payments';

if (!i18n.isInitialized) {
  // STANDALONE path: nobody initialised i18next yet.
  void i18n.use(initReactI18next).init({
    resources: {
      en: { payments: en },
      hi: { payments: hi },
      mr: { payments: mr },
    },
    lng: 'en',
    fallbackLng: 'en',
    ns: [NS],
    defaultNS: NS,
    interpolation: { escapeValue: false }, // React already escapes.
  });
} else {
  // EMBEDDED path: merge our bundles into the shell's live instance.
  i18n.addResourceBundle('en', NS, en, true, true);
  i18n.addResourceBundle('hi', NS, hi, true, true);
  i18n.addResourceBundle('mr', NS, mr, true, true);
}

export default i18n;
