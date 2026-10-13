import { afterEach, describe, expect, it } from 'vitest';
import type { KidzinkApi } from './openrouterKey';
import { isDistroAdmin, isDistroNavItemVisible } from './admin';

const setAdmin = (isAdmin: boolean) => {
  window.kidzink = { isAdmin, recipesDir: '' } as KidzinkApi;
};

describe('admin mode', () => {
  afterEach(() => setAdmin(false));

  it('is off unless the main process reports the admin file', () => {
    setAdmin(false);
    expect(isDistroAdmin()).toBe(false);
    setAdmin(true);
    expect(isDistroAdmin()).toBe(true);
  });

  it('hides extension, skill, app, schedule and recipe pages from staff', () => {
    setAdmin(false);
    for (const id of ['recipes', 'skills', 'apps', 'scheduler', 'extensions']) {
      expect(isDistroNavItemVisible(id)).toBe(false);
    }
    expect(isDistroNavItemVisible('home')).toBe(true);
    expect(isDistroNavItemVisible('sessions')).toBe(true);
  });

  it('shows every page to admins', () => {
    setAdmin(true);
    expect(isDistroNavItemVisible('extensions')).toBe(true);
  });
});
