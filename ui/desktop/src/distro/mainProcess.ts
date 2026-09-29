import { app, ipcMain, net } from 'electron';
import path from 'node:path';
import { APP_NAME, BRAND } from './brand';
import type { OpenRouterKeyCheck } from './openrouterKey';
import { VALIDATE_OPENROUTER_KEY_CHANNEL } from './ipcChannels';

// Runs inside main.ts's getBundledConfig() env-macro slot, before appConfig is built.
// Explicit environment variables still win, so IT and developers can override any of these.
export function applyDistroBundledEnv(): void {
  process.env.GOOSE_DEFAULT_PROVIDER ??= BRAND.provider;
  process.env.GOOSE_DEFAULT_MODEL ??= BRAND.defaultModel;
  if (BRAND.allowedModels.length > 0) {
    process.env.GOOSE_PREDEFINED_MODELS ??= JSON.stringify(
      BRAND.allowedModels.map((name) => ({ name, provider: BRAND.provider }))
    );
  }
  // Keeps config, sessions and logs apart from any regular goose install on the same machine.
  process.env.GOOSE_PATH_ROOT ??= path.join(app.getPath('userData'), 'backend');
}

// Passed to `goose serve`. Env vars take precedence over config.yaml, so only values staff
// should never change belong here.
export function distroBackendEnv(): Record<string, string> {
  return {
    GOOSE_KEYRING_SERVICE: APP_NAME,
    OPENROUTER_APP_TITLE: APP_NAME,
    OPENROUTER_APP_URL: BRAND.websiteUrl,
  };
}

function openRouterHost(): string {
  return (process.env.OPENROUTER_HOST || 'https://openrouter.ai').replace(/\/+$/, '');
}

// GET /api/v1/key describes the calling key without spending tokens. The key itself is never logged.
async function checkOpenRouterKey(key: string): Promise<OpenRouterKeyCheck> {
  const trimmed = key.trim();
  if (!trimmed) {
    return { ok: false, reason: 'invalid' };
  }
  let response: Response;
  try {
    response = await net.fetch(`${openRouterHost()}/api/v1/key`, {
      headers: { Authorization: `Bearer ${trimmed}` },
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'invalid' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'unexpected', status: response.status };
  }
  try {
    const body = (await response.json()) as { data?: { limit_remaining?: number | null } };
    return { ok: true, limitRemaining: body.data?.limit_remaining ?? null };
  } catch {
    return { ok: true, limitRemaining: null };
  }
}

export function registerDistroIpc(): void {
  ipcMain.handle(VALIDATE_OPENROUTER_KEY_CHANNEL, (_event, key: unknown) =>
    checkOpenRouterKey(typeof key === 'string' ? key : '')
  );
}
