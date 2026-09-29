import brand from './brand.json';

export const BRAND = {
  ...brand,
  // OpenRouter model slugs shown in the model picker; empty means every model OpenRouter lists.
  allowedModels: brand.allowedModels as string[],
};
export const APP_NAME = brand.appName;
