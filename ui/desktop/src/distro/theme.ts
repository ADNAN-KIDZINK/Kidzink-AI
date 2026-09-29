import { BRAND } from './brand';

export function applyBrandTokens(variant: 'light' | 'dark'): void {
  const colors = BRAND.colors[variant];
  const root = document.documentElement;
  root.style.setProperty('--kz-brand', colors.primary);
  root.style.setProperty('--kz-brand-hover', colors.primaryHover);
  root.style.setProperty('--kz-on-brand', colors.onPrimary);
}
