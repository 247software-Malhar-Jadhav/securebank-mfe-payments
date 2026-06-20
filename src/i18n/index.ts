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

// Our components call useTranslation() with NO explicit namespace, so they resolve keys
// against the instance's default namespace. When embedded that default is the shell's
// "translation" namespace — so we MUST contribute our keys there (not a private "payments"
// namespace), otherwise embedded screens show raw keys like "transfer.title". Our key
// prefixes (transfer.*, validation.*, beneficiaries.*) don't collide with the shell's.
const NS = 'translation';

if (!i18n.isInitialized) {
  // STANDALONE path: nobody initialised i18next yet.
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
    },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: NS,
    interpolation: { escapeValue: false }, // React already escapes.
  });
} else {
  // EMBEDDED path: merge our bundles into the shell's live instance under its default
  // namespace. deep=true merges; overwrite=false keeps the shell's strings authoritative.
  i18n.addResourceBundle('en', NS, en, true, false);
  i18n.addResourceBundle('hi', NS, hi, true, false);
  i18n.addResourceBundle('mr', NS, mr, true, false);
}

export default i18n;
