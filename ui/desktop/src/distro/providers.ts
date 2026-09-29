import type { ProviderDetails } from '../types/providers';
import { BRAND } from './brand';

// Staff only ever see the distribution's provider in provider lists and the model picker.
export function isDistroVisibleProvider(provider: ProviderDetails): boolean {
  return provider.name === BRAND.provider;
}
