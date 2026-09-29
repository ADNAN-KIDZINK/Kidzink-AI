import { acpSaveProviderConfig } from '../acp/providers';
import { BRAND } from './brand';

export type OpenRouterKeyCheck =
  | { ok: true; limitRemaining: number | null }
  | { ok: false; reason: 'invalid' | 'network' }
  | { ok: false; reason: 'unexpected'; status: number };

export interface KidzinkApi {
  validateOpenRouterKey: (key: string) => Promise<OpenRouterKeyCheck>;
}

declare global {
  interface Window {
    kidzink: KidzinkApi;
  }
}

export const OPENROUTER_KEY_FIELD = 'OPENROUTER_API_KEY';

export function keyCheckErrorMessage(check: Exclude<OpenRouterKeyCheck, { ok: true }>): string {
  switch (check.reason) {
    case 'invalid':
      return "That key didn't work. Make sure you copied the whole key (it starts with sk-or-), or ask IT for a new one.";
    case 'network':
      return "We couldn't reach OpenRouter. Check your internet connection and try again.";
    case 'unexpected':
      return `Something went wrong while checking your key (error ${check.status}). Try again in a minute, or contact ${BRAND.supportContact}.`;
  }
}

// Stored by the backend in the OS credential store (macOS Keychain / Windows Credential Manager).
export async function saveOpenRouterKey(key: string): Promise<void> {
  await acpSaveProviderConfig(BRAND.provider, [{ key: OPENROUTER_KEY_FIELD, value: key.trim() }]);
}
