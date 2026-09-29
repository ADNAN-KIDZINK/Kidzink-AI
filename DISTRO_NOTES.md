# Kidzink AI — distribution notes

Kidzink AI is Kidzink's internal, branded build of [goose](https://github.com/aaif-goose/goose)
(Apache 2.0), for about 140 non-technical staff on Windows and macOS. Each person uses
their own OpenRouter API key. Budgets and model access are controlled centrally in
OpenRouter, so the app never contains a shared key.

This file is the maintainer's reference: what we changed, where, and why. If you modify
an upstream file, record it here **and** in `distro/MODIFIED_UPSTREAM_FILES.txt`.

## Upstream base

| | |
|---|---|
| Upstream repo | `https://github.com/aaif-goose/goose` (remote `upstream`) |
| Our repo | `https://github.com/ADNAN-KIDZINK/Kidzink-AI` (remote `origin`), branch `main` |
| Forked from | `201837dff` — 2026-09-23, "fix(extensions): prevent Extension Manager from disabling itself (#12270)" |
| Upstream version at fork | desktop app `1.52.0`; nearest tag `gdk-v0.1.0-alpha.9` (+110 commits) |

The current base changes each time we sync. Get it with:

```bash
git merge-base main upstream/main
```

## Repository layout for our changes

Everything Kidzink-specific lives in new files where possible, so upstream merges stay clean:

| Path | Purpose |
|---|---|
| `ui/desktop/src/distro/brand.json` | Single source of truth for name, IDs, website, colours, support contact, provider, models and release repo |
| `ui/desktop/src/distro/` | Our desktop code: brand constants, English rebranding, brand colour tokens, feature flags, Kidzink logo and About card, backend env |
| `distro/assets/` | Logo source (`logo/kidzink-mark.svg`) and the icon generator (`gen-icons.sh`) |
| `distro/MODIFIED_UPSTREAM_FILES.txt` | Upstream files we edit (used by the sync script to flag conflicts) |
| `scripts/sync-upstream.sh` | Upstream sync tool (see below) |
| `DISTRO_NOTES.md` | This file |

Later phases add `distro/config/` (bundled defaults) and `distro/recipes/` (staff recipes).

`brand.json` lives inside `ui/desktop/` rather than `distro/` because the Vite dev server
only serves files inside the `ui/` pnpm workspace. The build config, the icon generator and
the app itself all read it from there.

**Conventions**
- Every edited upstream file starts with `// Modified by Kidzink for Kidzink AI (see DISTRO_NOTES.md).`
  (the Apache 2.0 modification notice) and is listed in `distro/MODIFIED_UPSTREAM_FILES.txt`.
- Keep edits to upstream files to one-line hooks into `ui/desktop/src/distro/` where possible.
- Hide upstream UI with a flag in `ui/desktop/src/distro/features.ts`; don't delete it.
- Our own components use plain English strings, not `defineMessages`. Adding message IDs would
  mean editing upstream's `en.json`, which `pnpm run i18n:check` compares against the source.
- Run Prettier only on our own files. Some upstream files aren't Prettier-clean, and
  reformatting them adds merge-conflict surface.

## Syncing with upstream

```bash
scripts/sync-upstream.sh --check    # preview: incoming commits, touched customizations, predicted conflicts
scripts/sync-upstream.sh --verify   # merge, then run cargo check + desktop typecheck
```

- We **merge** upstream into `main`. We don't rebase, because `main` is shared and each
  merge commit records which upstream version a release was built on.
- Before merging, the script saves the current state as `backup/pre-sync-<timestamp>`.
- Conflicts in files listed in `MODIFIED_UPSTREAM_FILES.txt` are labelled as Kidzink
  customizations. To resolve one: take upstream's change, re-apply our customization
  (described below), then `git add` and `git commit`.
- The script warns when upstream deletes or moves a file we customize.
- The script never pushes. After a full build and smoke test, run `git push origin main`.
- Exit codes: `0` up to date or clean, `1` conflicts predicted (`--check`), `2` merge
  stopped on conflicts, `3` precondition failed (dirty tree, wrong branch), `4` verify failed.

**Before every sync, read upstream's changes to `AGENTS.md` and `CUSTOM_DISTROS.md`.** They
announce migrations that affect us. Two are in progress now: the agent-loop state-machine
migration, and the retirement of the MCP server directory.

## Configuration values

From `ui/desktop/src/distro/brand.json`:

| Setting | Value |
|---|---|
| App name | Kidzink AI |
| Executable | `kidzink-ai` |
| Bundle ID | `com.kidzink.ai` |
| Primary colour | `#e43e2f` light (hover `#b92d22`), `#ff5244` dark (hover `#ff6b5a`), text on primary `#ffffff` |
| Font | Poppins |
| Logo | Kidzink K-mark, from `Kidzink-ui/src/components/logomark.tsx` (brand toolkit "KIDZINK LOGO PACK") |
| Support contact | adnan@kidzink.com |
| Provider | OpenRouter only |
| Default model | `anthropic/claude-sonnet-5` — **placeholder, to be confirmed** |
| Allowed models | Empty (the picker shows everything OpenRouter lists). **To be decided**; OpenRouter remains the real enforcement point. |
| Release channel | GitHub Releases on `ADNAN-KIDZINK/Kidzink-AI` |

Brand colours and fonts come from the `@kidzink/ui` design system (`Kidzink-ui/src/styles/theme.css`).

## Decisions (approved 2026-09-23)

- **Installers:** Squirrel `.exe` (per-user) on Windows and DMG on macOS. Both deploy
  through Intune as Win32 and macOS apps.
- **Languages:** English only. The other 15 upstream locales are not rebranded or shipped.
- **Admin mode:** switched on by a machine-level file placed by IT
  (`/Library/Application Support/Kidzink AI/admin.json` on macOS,
  `%PROGRAMDATA%\Kidzink AI\admin.json` on Windows). There is no visible toggle.
- **Rust changes:** limited to (1) a configurable keychain service name, so a regular goose
  install on the same machine can't share the stored key, and (2) mapping OpenRouter's
  key-limit and model-not-allowed 403 responses to the usage-limit error.
- **Office documents:** use the built-in `computercontroller` extension (Rust `xlsx_tool`,
  `docx_tool`, `pdf_tool`). A bundled Python server is the fallback only if its Word
  formatting proves inadequate.
- **Shell access:** removed from the `developer` extension through its `available_tools`
  allowlist, rather than relying on approval prompts.

## Upstream facts that shaped the design

These notes save the next person from rediscovering them:

- **`init-config.yaml` is dead code** despite `CUSTOM_DISTROS.md`. Nothing calls
  `load_init_config_from_workspace()` since upstream #8378. We use
  `GOOSE_ADDITIONAL_CONFIG_FILES` (a layered config merged under the user's `config.yaml`) instead.
- **The auto-updater feed is hardcoded** to `aaif-goose/goose` in
  `ui/desktop/src/utils/autoUpdater.ts`, and also appears in `src/app-update.yml`. Unless it
  is changed, staff would be offered upstream goose releases.
- **`main.ts` finds the app menu by the label `'Goose'`** to insert Settings. After a rename,
  that lookup must use the new name, or the Settings menu item silently disappears.
- **Per-tool `NeverAllow` permissions are ignored in the default `auto` mode.** Use
  `available_tools` on the extension to remove a tool.
- **Telemetry** (PostHog, backend only) is opt-in. The env var that forces it off is
  `GOOSE_TELEMETRY_OFF`; `GOOSE_DISABLE_TELEMETRY` in `CUSTOM_DISTROS.md` doesn't exist.
- **Env vars override `config.yaml`.** Setting `GOOSE_MODEL` in the environment would lock
  the model, so defaults go in the layered config file instead.
- **Agent-loop parity:** upstream is migrating from `agents/agent.rs` to
  `agents/state_machine/` (`GOOSE_STATE_MACHINE=1`). Any agent-loop behaviour we change must
  work in both.

## Customizations by phase

### Phase 1 — fork setup and upstream sync ✅

- The remotes were already configured: `origin` is our repo and `upstream` is aaif-goose/goose.
- Added `scripts/sync-upstream.sh`, `ui/desktop/src/distro/brand.json`, `distro/MODIFIED_UPSTREAM_FILES.txt`
  and this file.
- No upstream files modified.

### Phase 2 — branding ✅

**App icons**
- The logo source is `distro/assets/logo/kidzink-mark.svg`, the kidzink.com favicon: the
  red K, taken from `https://framerusercontent.com/images/XPdhJieF0pggH6u34p4hH1TQU.svg`.
- `distro/assets/gen-icons.sh` regenerates every file in `ui/desktop/src/images/`:
  - the app icon (red K on a white rounded tile, same 2048 grid as upstream) as SVG, PNGs,
    `.ico` and `.icns`
  - the black macOS menu-bar template icons
  - the "update available" tray variant with a red dot

  It needs `rsvg-convert`, ImageMagick and `iconutil` (macOS). Re-run it whenever the logo
  or `colors.light.primary` changes.
- `ui/desktop/src/main.ts`: when unpackaged, calls `app.dock.setIcon(src/images/icon.png)`.
  Without it, `pnpm run start-gui` shows Electron's own icon in the Dock. Packaged builds
  get the icon from `icon.icns` through `forge.config.ts`.
- Upstream's `ui/desktop/src/images/prepare.sh` is left unchanged. It rebuilds from
  `icon.svg`, which is now ours, so it still produces Kidzink icons.

**App name and packaging** (`forge.config.ts`)
- On macOS the executable is "Kidzink AI" rather than `kidzink-ai`. Electron Packager always
  sets `CFBundleDisplayName`, the name Finder shows, to the executable name, so a lowercase
  executable would make Finder show "kidzink-ai". Windows and Linux use `kidzink-ai`.
- Name, executable, bundle ID and Windows file metadata come from `brand.json`, as do the
  macOS microphone and Apple Events permission prompts. The Linux makers' `bin` uses the
  executable name; Linux is otherwise untouched and not a target.
- `package.json` is **not** edited: its `productName` sits next to `version`, which upstream
  bumps every release, so editing it would conflict on every sync. Instead the forge
  `readPackageJson` hook sets `productName` to "Kidzink AI". Forge applies it both to what the
  makers read and to the packaged app's copy of `package.json`. As a result, the packaged app's settings
  live in `~/Library/Application Support/Kidzink AI` and `%APPDATA%\Kidzink AI`.
- Dev runs (`pnpm run start-gui`) still read upstream's `productName`, so the macOS app menu
  says "Goose" in development only.
- Unchanged on purpose:
  - the `goose://` URL scheme (recipe and extension deeplinks depend on it)
  - the `persist:goose` session partition
  - `%LOCALAPPDATA%\Goose\bin` on Windows, used for command-line tool shims
  - log messages

**Name in the main process** (`main.ts`, `utils/autoUpdater.ts`, `index.html`)
- Changed to `APP_NAME`: the About panel (now with a "Powered by goose" credit),
  notifications, error dialogs, the "Focus … Window" and "About …" menu items, tray tooltips,
  the update-ready notification, and the window title.
- The app-menu lookup matches `app.name` instead of the literal `'Goose'`.

**Interface text** (`i18n/index.ts` → `src/distro/i18n.ts`)
- English is rebranded at runtime. `loadMessages('en')` returns a catalog built from upstream's
  `src/i18n/messages/en.json`, with the whole word "goose" replaced by the app name. The rule
  skips `.goosehints`, `.goose/`, `goose://`, `/home/goose` and `GOOSE_*`.
- This covers 66 strings. New upstream strings are picked up automatically, with no
  maintenance. `src/distro/i18n.test.ts` pins the rule.
- English only: `englishOnly()` forces English messages but keeps a regional English tag
  (such as en-GB) for date formats. The language picker is hidden. Other locale files stay in
  the tree, unused.

**Colours** (`src/distro/theme.css`, `src/distro/theme.ts`)
- New Tailwind tokens: `bg-brand`, `hover:bg-brand-hover`, `text-on-brand`, `fill-brand`. Their
  light and dark values come from `brand.json`, applied by `applyThemeTokens()`.
- Upstream's neutral palette is unchanged. Upstream's "inverse" (black/white) token also
  drives tooltips and selects, so it isn't recoloured.
- Applied to the default `Button` variant, the chat send button (when enabled) and checked
  `Switch`es.
- The purple "Aura" theme is removed from the theme picker; light, dark and system remain.
- **Poppins font:** not bundled. It would add a SIL OFL font to `THIRD_PARTY_LICENSES.md`.

**Logo inside the app** (`src/distro/KidzinkMark.tsx`)
- `icons/Goose.tsx` (`Goose`) and `icons/Geese.tsx` render the Kidzink K in brand red.
- `Rain`, the hover animation around the goose, renders nothing.
- `FlyingBird`, the streaming indicator, is a pulsing K.
- `Bird1`–`Bird6` are no longer rendered but still exist in the tree.

**Settings → App** (`AppSettingsSection.tsx`, flags in `src/distro/features.ts`)
- Hidden:
  - the language picker
  - upstream's Help card (it opens goose GitHub issues)
  - upstream's version card (Block logo)
- Added: `KidzinkAboutCard`, with the logo, version, a "Contact support" mailto link to the
  support contact, and the "Powered by goose (open source, Apache License 2.0)" credit and
  non-endorsement line.

**OpenRouter attribution** (`crates/goose/src/providers/openrouter_def.rs`, `src/distro/backendEnv.ts`)
- The `HTTP-Referer` and `X-Title` headers now read the config keys `OPENROUTER_APP_URL` and
  `OPENROUTER_APP_TITLE`, defaulting to upstream's values. This is a candidate to upstream.
- The desktop app sets them to `https://kidzink.com` and "Kidzink AI" through
  `distroBackendEnv()` in `src/distro/mainProcess.ts`, passed when `goose serve` starts. OpenRouter's activity logs then show
  "Kidzink AI".

### Phase 3 — provider and first-run key setup ✅

**Defaults and isolation** (`src/distro/mainProcess.ts`)
- `applyDistroBundledEnv()` runs in `main.ts`'s `getBundledConfig()` env-macro slot, upstream's
  intended hook for distros. It sets these only when they're not already set, so explicit env
  vars still win:
  - `GOOSE_DEFAULT_PROVIDER=openrouter`
  - `GOOSE_DEFAULT_MODEL=<brand.defaultModel>`
  - `GOOSE_PREDEFINED_MODELS` from `brand.allowedModels`, only when that list isn't empty;
    upstream's model picker then shows only those models
  - `GOOSE_PATH_ROOT=<userData>/backend`, which keeps config, sessions and logs apart from any
    regular goose install
- `distroBackendEnv()` passes these to `goose serve`:
  - `GOOSE_KEYRING_SERVICE="Kidzink AI"`
  - the OpenRouter attribution headers
- **We don't use `init-config.yaml`** (dead upstream) **or `GOOSE_ADDITIONAL_CONFIG_FILES`.** A
  bundled `GOOSE_PROVIDER` would make upstream think setup was already complete before a key
  exists. The guard below saves the defaults instead, through the normal ACP calls.

**Keychain name** (`crates/goose/src/config/base.rs`)
- `default_keyring_service()` reads `GOOSE_KEYRING_SERVICE`, defaulting to upstream's "goose".
  This is a candidate to upstream.
- Secrets are stored as one Keychain / Credential Manager entry: service "Kidzink AI", account
  "secrets".
- Verified: after key setup, the key exists only in that Keychain entry. It isn't in
  `config.yaml`, any other data file, or the logs.

**First-run screen** (`src/distro/KidzinkKeyGuard.tsx`, `ApiKeyForm.tsx`, `openrouterKey.ts`)
- `App.tsx` uses `KidzinkKeyGuard` instead of upstream's `OnboardingGuard`. Upstream's
  onboarding and provider selector are no longer reachable from startup.
- The guard asks the backend whether `openrouter` is configured:
  - If not, it shows the welcome screen: logo, one password field with show/hide, and help text.
  - If yes, `ensureDistroDefaults()` resets the saved default to OpenRouter and `defaultModel`
    whenever the provider isn't OpenRouter or the model isn't in a non-empty allowlist.
- Checking a key:
  - The renderer calls `window.kidzink.validateOpenRouterKey`, exposed in `preload.ts` on
    channel `kidzink:validate-openrouter-key`.
  - The main process calls `GET {OPENROUTER_HOST or https://openrouter.ai}/api/v1/key` with
    `net.fetch`. This costs no tokens and avoids CORS. 401/403 means invalid; a network failure
    or another status gets its own friendly message.
  - The key is never logged.
- A valid key is saved with the existing `acpSaveProviderConfig`, so the backend puts it in the
  OS credential store. Then the defaults are saved, and `GOOSE_TELEMETRY_ENABLED=false` is written
  so upstream's consent prompt never appears.
- A key that works but reports `limit_remaining <= 0` still saves, with a warning toast.

**Change API key** (`src/distro/ApiKeyCard.tsx`, shown in Settings → App)
- Opens the same form in a dialog, checks the new key and replaces the old one. New chats use the new key.

**Provider list** (`src/acp/providers.ts` → `src/distro/providers.ts`)
- `acpListProviderDetails()` filters to OpenRouter. This covers every upstream list: setup,
  settings, and the model picker's provider list. Admin mode (Phase 6) will lift the filter.
- Upstream's own provider-list unit tests mock the filter; `src/distro/providers.test.ts` tests it.

**Usage limits and blocked requests**
- **402** (credits or key budget used up) was already mapped to `CreditsExhausted`. Both agent
  loops deliver it as ACP error `reason: credits_exhausted`: the legacy loop as a system
  notification, the state machine as `MessageErrorKind::CreditsExhausted`. So both render
  `CreditsExhaustedNotification`, which now shows "AI usage limit reached — You've reached your
  AI usage limit for this period. Contact adnan@kidzink.com if you need more."
- **403**: `crates/goose-providers/src/openrouter.rs` classifies it itself, because upstream maps
  every 403 to Authentication ("sign in again"):
  - `error_type` `content_policy_violation` or `refusal` becomes `ProviderError::Refusal`.
  - Anything else (guardrail, model allowlist, permission) becomes
    `RequestFailed("OpenRouter blocked this request: <OpenRouter's message>")`.
  - 403 responses skip the retry loop, since a block fails the same way every time.
  - Unit tests are in the same file.
- **Known gap:** the legacy loop shows that block inline as "Ran into this error: Request failed:
  OpenRouter blocked this request: … Please retry if you think this is a transient or recoverable
  error." Friendlier wording would mean editing both agent loops' generic error text.
- **401 during chat** (a revoked key): `formatAcpError` shows "Your API key isn't working any more.
  Go to Settings → App → Change API key…".

**Also rebranded**
- The chat window's top-right watermark (`BaseChat.tsx`) now says "Kidzink AI" and links to
  kidzink.com instead of goose-docs.ai.

**Testing without a real key** (`distro/testing/`)
- `mock_openrouter.py <port> <logfile>` is a stand-in OpenRouter with these keys:
  - `sk-or-v1-good`: works
  - `sk-or-v1-empty`: valid but has no usage left
  - `sk-or-v1-broke`: chat returns 402
  - `sk-or-v1-blocked`: chat returns a 403 guardrail block
  - anything else: 401
- `drive-key-setup.js [setup|settings <key>|chat <text> <label>]` drives a dev app started with
  `ENABLE_PLAYWRIGHT=true OPENROUTER_HOST=http://127.0.0.1:<port> GOOSE_PATH_ROOT=<temp dir>` over
  CDP and saves screenshots to `$OUT_DIR`.
- Remove the test Keychain item afterwards: `security delete-generic-password -s "Kidzink AI" -a secrets`.

### Phase 3b — Microsoft sign-in and automatic keys (in progress)

Decided 2026-09-23: staff sign in with their Kidzink Microsoft account instead of pasting a key.
This reuses the shared Kidzink Supabase project (`hxpabclqbqrukmfqdahz`), which is already the
Entra client for Kompass and the quotation app and admits `kidzink.com` only.

- **Done — key broker** (`distro/key-broker/`, see its README):
  - A Supabase Edge Function, `kidzink-ai-key`, with a `kidzink_ai` schema holding
    `model_groups`, `entitlements` (the staff list IT edits) and `issued_keys` (keys encrypted
    with AES-GCM).
  - It creates one OpenRouter key per person via the management API, with a monthly limit, and
    one guardrail per model group as the allowlist. Model ids are translated to OpenRouter's
    canonical slugs, which guardrails require.
  - A daily pg_cron sync disables leavers' keys.
  - 14 unit tests.
  - Not deployed; the shared project's administrator applies it.
- **Next — app sign-in:**
  - "Sign in with Microsoft" through Supabase's OAuth PKCE flow, in the system browser, with a
    loopback callback on `127.0.0.1:53682`.
  - `/sign-in` returns the key, which is stored as in Phase 3.
  - A startup check calls `/entitlements`, which signs out removed staff and updates the model
    list.
  - The Phase 3 paste-key screen stays as the admin-only fallback.

### Phase 4 — bundled extensions and document abilities

_Not started._

### Phase 5 — recipes

_Not started._

### Phase 6 — lock-down and privacy

_Not started._

### Phase 7 — build, signing and updates

_Not started._

### Phase 8 — staff and IT documentation

_Not started._

## Licensing

- Upstream `LICENSE` (Apache 2.0) stays unchanged. Upstream has no `NOTICE` file; we add one
  in Phase 8 to credit goose and describe our modifications.
- Each modified upstream file gets a one-line header, `Modified by Kidzink for Kidzink AI`,
  and is listed in `distro/MODIFIED_UPSTREAM_FILES.txt`.
- The goose name and logo appear only in the About screen's "Powered by goose (open source)" credit.
- Every bundled third-party component goes in `THIRD_PARTY_LICENSES.md`. Anything not
  permissively licensed must be flagged before it is included.
