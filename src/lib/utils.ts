import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — the shadcn/ui class-name helper. Merges conditional class lists
 * (clsx) and then de-duplicates/normalises conflicting Tailwind utilities
 * (tailwind-merge) so the last-wins rule is honoured.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric amount as localized currency using the platform's standard
 * Intl.NumberFormat. We NEVER do ad-hoc string concatenation for money.
 *
 * @param amount   the value (already a Number; the API sends BigDecimal-as-number)
 * @param currency ISO-4217 code, e.g. "INR", "USD"
 * @param locale   BCP-47 locale, e.g. "en", "hi", "mr" (defaults to en-IN style)
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale = 'en-IN',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  } catch {
    // Defensive: an unknown currency code should never crash a screen.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Map an i18next language tag to a sensible BCP-47 locale for number/currency
 * formatting. Indian languages format money with the Indian digit grouping.
 */
export function localeForLanguage(lng: string | undefined): string {
  switch ((lng ?? 'en').split('-')[0]) {
    case 'hi':
      return 'hi-IN';
    case 'mr':
      return 'mr-IN';
    default:
      return 'en-IN';
  }
}
