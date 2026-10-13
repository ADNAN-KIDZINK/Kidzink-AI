import { BRAND, type ModelTier } from './brand';

// OpenRouter may report a dated or variant id (e.g. `anthropic/claude-sonnet-5-20260801`) as
// the resolved model, so match on the tier's slug as a prefix too.
function tierForModel(modelId: string): ModelTier | undefined {
  return BRAND.modelTiers.find(
    (tier) =>
      modelId === tier.model ||
      modelId.startsWith(`${tier.model}-`) ||
      modelId.startsWith(`${tier.model}:`)
  );
}

export function distroModelDisplayName(modelId: string): string {
  return tierForModel(modelId)?.label ?? modelId;
}

// Feeds upstream's GOOSE_PREDEFINED_MODELS, which turns the model picker into a list of aliases.
export function distroPredefinedModels() {
  return BRAND.modelTiers.map((tier) => ({
    name: tier.model,
    provider: BRAND.provider,
    alias: tier.label,
    subtext: tier.description,
  }));
}
