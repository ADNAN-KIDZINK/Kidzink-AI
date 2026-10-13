import { app, ipcMain, net } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { APP_NAME, BRAND } from './brand';
import type { DistroInfo, OpenRouterKeyCheck } from './openrouterKey';
import { DISTRO_INFO_CHANNEL, VALIDATE_OPENROUTER_KEY_CHANNEL } from './ipcChannels';
import { distroPredefinedModels } from './models';

// IT switches on admin mode per machine by placing this file; there is no in-app toggle.
function adminFlagPath(): string | null {
  switch (process.platform) {
    case 'darwin':
      return path.join('/Library/Application Support', APP_NAME, 'admin.json');
    case 'win32':
      return path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', APP_NAME, 'admin.json');
    default:
      return null;
  }
}

let adminMode: boolean | undefined;

export function isDistroAdmin(): boolean {
  if (adminMode === undefined) {
    const flagPath = adminFlagPath();
    adminMode = !!flagPath && fs.existsSync(flagPath);
  }
  return adminMode;
}

// Packaged builds get the repo's distro/ folders as extraResource (forge.config.ts);
// dev runs start in ui/desktop and read them from the repo.
function distroResourcePath(name: 'config' | 'recipes' | 'skills' | 'launchers'): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, name)
    : path.resolve(process.cwd(), '..', '..', 'distro', name);
}

export function distroRecipesDir(): string {
  return distroResourcePath('recipes');
}

function prependToPathList(existing: string | undefined, entry: string): string {
  return [entry, ...(existing ? existing.split(path.delimiter) : [])]
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .join(path.delimiter);
}

// Runs inside main.ts's getBundledConfig() env-macro slot, before appConfig is built.
// Explicit environment variables still win, so IT and developers can override any of these.
export function applyDistroBundledEnv(): void {
  process.env.GOOSE_DEFAULT_PROVIDER ??= BRAND.provider;
  process.env.GOOSE_DEFAULT_MODEL ??= BRAND.defaultModel;
  process.env.GOOSE_PREDEFINED_MODELS ??= JSON.stringify(distroPredefinedModels());
  // Keeps config, sessions and logs apart from any regular goose install on the same machine.
  process.env.GOOSE_PATH_ROOT ??= path.join(app.getPath('userData'), 'backend');
  // Layered under the user's config.yaml: turns on the Office/PDF tools for everyone.
  process.env.GOOSE_ADDITIONAL_CONFIG_FILES = prependToPathList(
    process.env.GOOSE_ADDITIONAL_CONFIG_FILES,
    path.join(distroResourcePath('config'), 'kidzink-defaults.yaml')
  );
  process.env.GOOSE_RECIPE_PATH = prependToPathList(
    process.env.GOOSE_RECIPE_PATH,
    distroRecipesDir()
  );
  // kz-python, which the instructions and skills use to run Python. The backend's own bin
  // folder (with uvx) is put in front of this PATH by gooseServe.ts.
  process.env.PATH = prependToPathList(process.env.PATH, distroResourcePath('launchers'));
  installDistroKnowHow(path.join(process.env.GOOSE_PATH_ROOT, 'config'));
}

// goose reads <config>/prompts/system.md in place of its built-in system prompt, and discovers
// skills in <config>/skills. Both are refreshed from the app on every start, so an update ships
// new instructions; skills we stop shipping are removed, other skills there are left alone.
function installDistroKnowHow(configDir: string): void {
  try {
    const promptsDir = path.join(configDir, 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.copyFileSync(
      path.join(distroResourcePath('config'), 'system.md'),
      path.join(promptsDir, 'system.md')
    );

    const source = distroResourcePath('skills');
    const target = path.join(configDir, 'skills');
    const manifestPath = path.join(target, '.kidzink-skills.json');
    fs.mkdirSync(target, { recursive: true });
    let previous: string[] = [];
    try {
      previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      // First install, or the manifest was removed.
    }
    const current = fs
      .readdirSync(source, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    for (const name of new Set([...previous, ...current])) {
      fs.rmSync(path.join(target, name), { recursive: true, force: true });
    }
    for (const name of current) {
      fs.cpSync(path.join(source, name), path.join(target, name), { recursive: true });
    }
    fs.writeFileSync(manifestPath, JSON.stringify(current));
  } catch (error) {
    console.error('Failed to install Kidzink AI instructions and skills:', error);
  }
}

function bundledBinDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(process.cwd(), 'src', 'bin');
}

// The first kz-python or web-search run downloads uv, Python and the libraries (about 30 s).
// Doing it in the background after start-up means the first real request doesn't wait.
// Repeated once per app version, until it succeeds.
function warmUpPython(): void {
  const goosePathRoot = process.env.GOOSE_PATH_ROOT;
  if (!goosePathRoot) {
    return;
  }
  const marker = path.join(goosePathRoot, `.kidzink-python-ready-${app.getVersion()}`);
  if (fs.existsSync(marker)) {
    return;
  }
  const isWindows = process.platform === 'win32';
  // A copy of process.env is case-sensitive, and Windows spells it "Path".
  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
  const env = {
    ...process.env,
    [pathKey]: prependToPathList(process.env[pathKey], bundledBinDir()),
  };
  const run = (command: string, args: string[]) =>
    new Promise<boolean>((resolve) => {
      const child = spawn(command, args, {
        env,
        cwd: goosePathRoot,
        stdio: 'ignore',
        shell: isWindows,
        windowsHide: true,
      });
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0));
    });
  const launcher = path.join(
    distroResourcePath('launchers'),
    isWindows ? 'kz-python.cmd' : 'kz-python'
  );
  void (async () => {
    const python = await run(launcher, [
      '-c',
      'import openpyxl, docx, pptx, pypdf, pdfplumber, pandas',
    ]);
    const search = await run(isWindows ? 'uvx.exe' : 'uvx', ['--quiet', 'ddgs', 'version']);
    if (python && search) {
      fs.writeFileSync(marker, new Date().toISOString());
    }
  })();
}

// Passed to `goose serve`. Env vars take precedence over config.yaml, so only values staff
// should never change belong here.
export function distroBackendEnv(): Record<string, string> {
  return {
    GOOSE_KEYRING_SERVICE: APP_NAME,
    // Forces upstream's PostHog telemetry off whatever the config says.
    GOOSE_TELEMETRY_OFF: '1',
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
  void app.whenReady().then(() => setTimeout(warmUpPython, 15_000));
  // Synchronous because preload exposes it as plain values before the renderer starts.
  ipcMain.on(DISTRO_INFO_CHANNEL, (event) => {
    const info: DistroInfo = { isAdmin: isDistroAdmin(), recipesDir: distroRecipesDir() };
    event.returnValue = info;
  });
  ipcMain.handle(VALIDATE_OPENROUTER_KEY_CHANNEL, (_event, key: unknown) =>
    checkOpenRouterKey(typeof key === 'string' ? key : '')
  );
}
