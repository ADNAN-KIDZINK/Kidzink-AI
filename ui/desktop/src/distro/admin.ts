// Set by IT per machine (see isDistroAdmin in mainProcess.ts); fixed for the window's lifetime.
export function isDistroAdmin(): boolean {
  return window.kidzink?.isAdmin === true;
}

// Sidebar pages staff don't need: extensions, skills, apps and schedules change what the
// assistant can run, and the recipe library can import recipes that add extensions.
const ADMIN_ONLY_NAV_ITEMS = new Set(['recipes', 'skills', 'apps', 'scheduler', 'extensions']);

export function isDistroNavItemVisible(id: string): boolean {
  return isDistroAdmin() || !ADMIN_ONLY_NAV_ITEMS.has(id);
}
