import { describe, expect, it } from 'vitest';
import type { ProviderDetails } from '../types/providers';
import { isDistroVisibleProvider } from './providers';

const provider = (name: string) => ({ name }) as ProviderDetails;

describe('isDistroVisibleProvider', () => {
  it('shows only OpenRouter', () => {
    expect(isDistroVisibleProvider(provider('openrouter'))).toBe(true);
    expect(isDistroVisibleProvider(provider('anthropic'))).toBe(false);
    expect(isDistroVisibleProvider(provider('claude-acp'))).toBe(false);
  });
});
