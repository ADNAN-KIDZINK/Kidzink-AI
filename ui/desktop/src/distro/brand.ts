import brand from './brand.json';

export interface ModelTier {
  label: string;
  model: string;
  description: string;
}

const modelTiers: ModelTier[] = brand.modelTiers;

export const BRAND = {
  ...brand,
  // Staff pick a tier label; the OpenRouter model slug behind it is never shown.
  modelTiers,
  allowedModels: modelTiers.map((tier) => tier.model),
};
export const APP_NAME = brand.appName;
