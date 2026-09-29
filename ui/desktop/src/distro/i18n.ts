import sourceMessages from '../i18n/messages/en.json';
import { APP_NAME } from './brand';

// Matches the product name "goose"/"Goose" as a word, but not technical identifiers that must
// keep working: .goosehints, .goose/ folders, goose:// deeplinks, /home/goose paths, GOOSE_* env vars.
const PRODUCT_NAME = /(?<![./\w])goose(?![:/\w])/gi;

export function brandText(text: string): string {
  return text.replace(PRODUCT_NAME, APP_NAME);
}

// English strings otherwise come from each component's defaultMessage, so this catalog only
// needs the messages whose text changes.
export function brandedEnglishMessages(): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const [id, { defaultMessage }] of Object.entries(sourceMessages)) {
    const branded = brandText(defaultMessage);
    if (branded !== defaultMessage) {
      messages[id] = branded;
    }
  }
  return messages;
}

// The distribution ships English only; a regional English tag is kept for date/number formatting.
export function englishOnly(resolved: { locale: string; messageLocale: string }): {
  locale: string;
  messageLocale: string;
} {
  return {
    locale: resolved.locale.toLowerCase().startsWith('en') ? resolved.locale : 'en',
    messageLocale: 'en',
  };
}
