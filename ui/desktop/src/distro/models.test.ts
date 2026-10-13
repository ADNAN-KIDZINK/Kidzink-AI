import { describe, expect, it } from 'vitest';
import { BRAND } from './brand';
import { distroModelDisplayName, distroPredefinedModels } from './models';

const [low, medium, high] = BRAND.modelTiers;

describe('distroModelDisplayName', () => {
  it('shows the tier label instead of the model slug', () => {
    expect(distroModelDisplayName(low.model)).toBe('Low');
    expect(distroModelDisplayName(medium.model)).toBe('Medium');
    expect(distroModelDisplayName(high.model)).toBe('High');
  });

  it('labels dated or variant ids that OpenRouter reports as the resolved model', () => {
    expect(distroModelDisplayName(`${medium.model}-20260801`)).toBe('Medium');
    expect(distroModelDisplayName(`${high.model}:thinking`)).toBe('High');
  });

  it('leaves models outside the tiers unchanged', () => {
    expect(distroModelDisplayName('openai/gpt-6-sol')).toBe('openai/gpt-6-sol');
  });
});

describe('distroPredefinedModels', () => {
  it('lists every tier on OpenRouter with its label as the alias', () => {
    expect(distroPredefinedModels().map((m) => [m.alias, m.provider])).toEqual([
      ['Low', 'openrouter'],
      ['Medium', 'openrouter'],
      ['High', 'openrouter'],
    ]);
  });

  it('includes the default model, so first-run defaults land on a tier', () => {
    expect(BRAND.allowedModels).toContain(BRAND.defaultModel);
  });
});
