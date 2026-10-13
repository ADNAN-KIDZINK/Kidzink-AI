import { setConfigExtensionEnabled } from '../acp/extensions';
import { isDistroAdmin } from './admin';

// Platform extensions the backend turns on by default that staff shouldn't have: the
// extension manager would let the assistant install new extensions, and the rest add
// subagents, schedules, mini-apps and code tools that non-technical staff don't use.
// These are platform extensions: the backend writes their defaults into the user's
// config.yaml, where distro/config/kidzink-defaults.yaml (a layer underneath) can't change them.
const STAFF_DISABLED_EXTENSIONS = [
  'extensionmanager',
  'apps',
  'summon',
  'scheduler',
  'analyze',
  'code_execution',
  'orchestrator',
];

// kidzink-defaults.yaml switches this on for new installs; installs that already saved it as
// off (it was off before Kidzink AI enabled it) need it switched on here.
const STAFF_ENABLED_EXTENSIONS = ['computercontroller'];

// Runs on every start, so a change made through a deep link or an older build is undone.
// A key the backend doesn't know (e.g. code_execution in builds without code mode) is skipped.
export async function applyDistroExtensionPolicy(): Promise<void> {
  if (isDistroAdmin()) {
    return;
  }
  const apply = (key: string, enabled: boolean) =>
    setConfigExtensionEnabled(key, enabled).catch(() => {});
  await Promise.all([
    ...STAFF_DISABLED_EXTENSIONS.map((key) => apply(key, false)),
    ...STAFF_ENABLED_EXTENSIONS.map((key) => apply(key, true)),
  ]);
}
