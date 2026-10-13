import { afterEach, describe, expect, it } from 'vitest';
import type { ProviderDetails } from '../types/providers';
import type { KidzinkApi } from './openrouterKey';
import { isDistroVisibleProvider } from './providers';

const provider = (name: string) => ({ name }) as ProviderDetails;

const setAdmin = (isAdmin: boolean) => {
  window.kidzink = { isAdmin, recipesDir: '' } as KidzinkApi;
};

describe('isDistroVisibleProvider', () => {
  afterEach(() => setAdmin(false));

  it('shows only OpenRouter to staff', () => {
    setAdmin(false);
    expect(isDistroVisibleProvider(provider('openrouter'))).toBe(true);
    expect(isDistroVisibleProvider(provider('anthropic'))).toBe(false);
    expect(isDistroVisibleProvider(provider('claude-acp'))).toBe(false);
  });

  it('shows every provider in admin mode', () => {
    setAdmin(true);
    expect(isDistroVisibleProvider(provider('anthropic'))).toBe(true);
  });
});
