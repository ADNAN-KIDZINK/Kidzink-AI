import type { ProviderDetails } from '../types/providers';
import { isDistroAdmin } from './admin';
import { BRAND } from './brand';

// Staff only ever see the distribution's provider in provider lists and the model picker.
export function isDistroVisibleProvider(provider: ProviderDetails): boolean {
  return isDistroAdmin() || provider.name === BRAND.provider;
}
