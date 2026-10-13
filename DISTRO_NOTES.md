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
| `distro/config/` | Bundled backend defaults (`kidzink-defaults.yaml`) and the base instructions that replace goose's (`system.md`) |
| `distro/skills/` | Kidzink's skills: one folder per kind of work, with `SKILL.md` and tested helper scripts |
| `distro/launchers/` | `kz-python` (macOS) and `kz-python.cmd` (Windows): run Python with the standard libraries via the bundled `uvx` |
| `distro/recipes/` | The task cards on the home screen, one recipe YAML each |
| `distro/git-hooks/` | Pre-commit secret scan |
| `distro/testing/` | Mock OpenRouter and the CDP test driver |
| `distro/MODIFIED_UPSTREAM_FILES.txt` | Upstream files we edit (used by the sync script to flag conflicts) |
| `scripts/sync-upstream.sh` | Upstream sync tool (see below) |
| `DISTRO_NOTES.md` | This file |

`distro/config/`, `distro/recipes/`, `distro/skills/` and `distro/launchers/` ship inside the app as
`Resources/<name>` (`extraResource` in `forge.config.ts`); dev runs read them from the repo.

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
| Model tiers | Low `anthropic/claude-haiku-4.5`, Medium `anthropic/claude-sonnet-5`, High `anthropic/claude-opus-5.5`. Staff see only the tier labels. **Models are placeholders, to be confirmed.** |
| Default model | `anthropic/claude-sonnet-5` (Medium). It must be one of the tier models. |
| Updates | None. Auto-update is off (`UPDATES_ENABLED = false`); new builds are shared by hand. |

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
- **Shell access:** ~~removed from the `developer` extension~~. **Reversed 2026-10-05:** the
  assistant has the full `developer` extension, shell included, like Claude Code. goose's own
  Office tools can't create spreadsheets or Word tables, so the assistant makes Office files by
  writing a Python script and running it through the bundled `uvx` (see Phase 4).

## Scope change (2026-10-05)

Dropped: **Phase 3b** (Microsoft sign-in and the key broker), **Phase 7** (CI builds, signing,
our own update feed) and **Phase 8** (staff and IT guides). As a result:
- Staff paste their own OpenRouter key on the Phase 3 welcome screen.
- Builds are made locally and signed ad hoc (`just package-ui`-style). macOS testers must
  approve the app once under System Settings → Privacy & Security → **Open Anyway**. For a
  test DMG: stage the `.app` next to an `/Applications` symlink and run `hdiutil create -format UDZO`.
- There is no update feed, so the upstream one is switched off (Phase 6).
- `distro/key-broker/` is unused. It stays in the tree until someone decides to delete it.

## Upstream facts that shaped the design

These notes save the next person from rediscovering them:

- **`init-config.yaml` is dead code** despite `CUSTOM_DISTROS.md`. Nothing calls
  `load_init_config_from_workspace()` since upstream #8378. We use
  `GOOSE_ADDITIONAL_CONFIG_FILES` (a layered config merged under the user's `config.yaml`) instead.
- **The auto-updater feed is hardcoded** to `aaif-goose/goose` in
  `ui/desktop/src/utils/autoUpdater.ts`, and also appears in `src/app-update.yml`. Unless it
  is changed, staff would be offered upstream goose releases. We switch the updater off (Phase 6).
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

### Phase 3b — Microsoft sign-in and automatic keys (dropped 2026-10-05)

Not shipping. The record below is kept in case it comes back.

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

### Model tiers (Low / Medium / High) ✅

Decided 2026-10-02: staff choose a tier, never a model name.

- **Where tiers are defined:** `modelTiers` in `brand.json`. Each tier has a `label`, an OpenRouter `model`
  slug and a one-line `description`. To swap a model, edit only that slug. `BRAND.allowedModels` is
  derived from the tiers, so `ensureDistroDefaults()` resets any non-tier saved model to `defaultModel`.
- **Picker:** `applyDistroBundledEnv()` sets `GOOSE_PREDEFINED_MODELS` from the tiers, using
  `alias` = label and `subtext` = description (`src/distro/models.ts`). That switches upstream's
  Switch Models dialog from provider and model dropdowns to a radio list of the three tiers.
- **Other places names appear:** upstream's `getModelDisplayName()` (`predefinedModelsUtils.ts`) now
  falls back to `distroModelDisplayName()`. That function also labels dated or variant ids that
  OpenRouter reports as the resolved model (`<slug>-…`, `<slug>:…`). It covers the bottom-bar menu,
  the "resolved model" line, Settings → Models, and "model changed" notices in chat.
- **Bottom-bar label** (`ModelsBottomBar.tsx`): upstream showed the raw model id next to the chat box.
  It now goes through `getModelDisplayName()`. Upstream's test was updated to expect that.
- **Provider name** under each tier ("• openrouter") is hidden by `DISTRO_FEATURES.predefinedModelProvider`
  (`SwitchModelModal.tsx`).
- **Verified:** in the dev app against the mock OpenRouter, the dialog lists only Low, Medium and High
  with their descriptions, and the chat box shows "Medium". Run `drive-key-setup.js models` to check again.
- **Who gets which tier:** this is enforced by the key broker. A person's `model_group` lists tier
  model slugs, and the group's OpenRouter guardrail allows only those models.
- **Who gets which tier, now that sign-in is dropped:** everyone sees all three. To restrict a
  person, IT adds a guardrail to their key in the OpenRouter dashboard. If they then pick a blocked
  tier, they get the 403 "OpenRouter blocked this request: …" error, and OpenRouter's text may
  name the model.
- **Known gaps:**
  - The standing instructions (Phase 4) tell the model to call itself Kidzink AI and not name the
    underlying model. That is an instruction, not a guarantee.
  - The "Failed to change model" error toast (`ModelAndProviderContext.tsx`) still shows the raw id.

### Phase 4 — bundled extensions and document abilities ✅

**What goose's built-in tools can and can't do** (checked in `crates/goose-mcp/src/computercontroller/`):
- `xlsx_tool` reads workbooks and changes one cell at a time. It **can't create a new
  workbook**, add sheets or format cells.
- `docx_tool` creates documents with headings, bold, italic, colour, alignment and images. It
  has **no tables or lists**.
- `pdf_tool` extracts text and images. Dropped images go to the model directly; dropped PDFs and
  other files arrive only as a path (`ChatInput.tsx` `appendDroppedFilePaths`).

**How Office files are made:** through skills and the `kz-python` launcher. See "Know-how layer"
below; this replaced an earlier approach of free-form `uvx` scripts.
- **Lessons from the first real test (2026-10-05)** that led to the know-how layer:
  - Given "help me build a strategy", the model produced a Word document and a spreadsheet nobody
    asked for, styled heavily, with claims and figures that weren't in the source.
  - Its `uvx` call failed on a relative path (the macOS `uvx` shim `cd`s into its hermit folder,
    `src/bin/uvx`), so it fell back to about 30 `docx_tool` calls ($0.76 in total).
  - `docx_tool` doesn't escape `&` in table text, which corrupts the file (an upstream bug, not reported yet).

**Extensions** (verified in the packaged app against the mock: the model received exactly
`shell, write, edit, tree, read_image, load_skill` and `computercontroller__{xlsx,docx,pdf}_tool`)

| Extension | State | Set by |
|---|---|---|
| developer | On, all tools including `shell` | upstream default |
| computercontroller | On, only `xlsx_tool`, `docx_tool`, `pdf_tool` (screen control off) | `distro/config/kidzink-defaults.yaml`, plus the policy for older installs |
| tom (Top Of Mind) | On (nothing configured for it) | upstream default |
| skills | On; lists and loads the Kidzink skills | upstream default |
| extensionmanager, apps, summon, scheduler, analyze, code_execution, orchestrator | Off | `src/distro/extensionPolicy.ts` |
| memory, todo, chatrecall, summarize, autovisualiser, tutorial | Off | upstream default |

- **Why two mechanisms:** `GOOSE_ADDITIONAL_CONFIG_FILES` (set in `applyDistroBundledEnv()`)
  layers our YAML under the user's `config.yaml`, field by field. That works for builtin
  extensions and for `available_tools`, which the desktop never writes. But the backend writes
  every platform extension's default `enabled` into the user's file on the first write, so a layer
  underneath can't turn platform extensions off. `applyDistroExtensionPolicy()` therefore sets them
  through ACP on every start, from `KidzinkKeyGuard`, then refreshes the extension list that new
  chats are built from. Admins (Phase 6) are skipped.
- **Approval mode** stays upstream's default (`auto`: no prompts). IT can change it in admin mode
  under Settings → Chat.

### Phase 5 — recipes ✅

- **Sixteen recipes** in `distro/recipes/`, one per common use in the staff survey (71 replies,
  2026-10-05), ordered by how many people ticked it: write an email, compare options, research a
  topic, brainstorm, draft a document, summarise a document, summarise a meeting, learn something,
  analyse a spreadsheet, make a spreadsheet, make a presentation, prepare for a meeting, plan a
  project, translate, review a contract, read an image.
- Each recipe is thin: a one-line task plus "load the <name> skill", a `message:` pill and three
  starter pills. The know-how lives in the skills, so recipes and normal chats behave the same.
- **Shipped via `GOOSE_RECIPE_PATH`** (prepended in `applyDistroBundledEnv()`). The backend lists
  them along with the person's own recipes.
- **No `extensions:` in the recipes, on purpose.** A recipe's extension list replaces the session's,
  which would bypass the Phase 4 setup. Without one, recipe chats get the normal extensions.
- **No `parameters`, on purpose.** Upstream's parameter dialog asks for files as a typed path. Instead,
  each recipe uses `activities`: a `message:` pill with guidance, plus three starter pills. Staff drop
  their files into the chat.
- **Home screen cards** (`src/distro/RecipeCards.tsx`, one hook in `Hub.tsx`):
  - Shows the bundled recipes only, sorted by file name, so the number prefix sets the order.
    Matching is by folder, since recipe ids are hashes of the install path.
  - Icons are keyed by file name; a new recipe gets a default icon.
  - Clicking records the recipe as trusted first, so upstream's "do you trust this recipe?" prompt
    doesn't appear for our own recipes.
  - Uses the folder picked on the home screen, if any.
- **To add a recipe:** drop a YAML file into `distro/recipes/` (for example `17-….yaml`), run
  `distro/testing/check-knowhow.sh`, and rebuild. Add an icon for its file name in
  `RecipeCards.tsx` if you like; otherwise it gets a default one.

### Know-how layer (2026-10-05) ✅

goose's engine (the think, act, check loop) is comparable to Claude Code's; what it lacks out of the
box is the know-how layer around it. Ours has four parts, all built from the staff survey.

**1. Base instructions** (`distro/config/system.md`)
- Replaces goose's 39-line `system.md`. goose renders `<config>/prompts/system.md` instead of its
  built-in one when that file exists (`prompt_template.rs`), in both agent loops (both use
  `PromptManager`). It keeps upstream's template hooks: the Top Of Mind block and the extensions loop.
- Covers who staff are, judgement (answer in chat unless a file is asked for, outline before long
  pieces, no unrequested extras), accuracy (only the person's facts, [to confirm], no guessed
  numbers), writing style, which skills exist and to prefer them, files, tools and safety.
- Installed by `installDistroKnowHow()` (`src/distro/mainProcess.ts`) on every start, so updates ship
  new instructions. An admin's edit in Settings → Prompts is overwritten at the next start.
- The earlier per-turn note (`kidzink-instructions.md` via `GOOSE_MOIM_MESSAGE_FILE`) is gone. It
  cost tokens on every turn; the system prompt is cached.

**2. Skills** (`distro/skills/`, 16)
- word-documents, excel-spreadsheets, powerpoint-slides, pdf-files, emails-and-messages, research,
  compare-and-analyse, summarise, brainstorming, contract-review, translation, project-planning,
  meeting-prep, explain-and-teach, images, scripts-and-automation.
- Same format as Claude's skills: a folder with `SKILL.md` (YAML header with `name` and
  `description`, then the guide) and optional `scripts/`. goose lists the names and descriptions in
  the system prompt, and the model loads a skill's full text with `load_skill` only when needed
  (about 200–500 tokens each). Loaded skills give the model the full path of each helper script.
- **Quote the `description`** in the header. An unquoted description containing ": " is invalid
  YAML, and goose silently skips that skill. This hit 5 of the 16 at first.
- Copied to `<config>/skills` on every start. `.kidzink-skills.json` there records which folders are
  ours, so skills we stop shipping are removed and nothing else is touched.
- **Other skills also appear:** goose also scans `~/.agents/skills`, `~/.claude/skills` and
  `~/.config/agents/skills`, plus two built-ins (web-search, goose-doc-guide). Anyone who uses
  Claude Code will see their own skills listed too. The base instructions name Kidzink's skills and
  tell the model to prefer them over look-alikes such as `docx` or `pdf`. Filtering them out would
  need a Rust change.

**3. Tested helper scripts** (in the skills' `scripts/` folders)

| Script | Does |
|---|---|
| `word-documents/scripts/make_docx.py` | Markdown → .docx: title, Heading 1–3, bullets (2 levels), numbering, quotes, tables (Table Grid, bold header), bold/italic, page breaks, yellow highlight on [to confirm]. Escapes `&` and friends correctly. |
| `word-documents/scripts/read_docx.py` | .docx → Markdown-style text in document order, tables included |
| `word-documents/scripts/replace_in_docx.py` | find/replace from a JSON list across body, tables, headers and footers; refuses to overwrite the original |
| `excel-spreadsheets/scripts/make_xlsx.py` | JSON spec → .xlsx: typed columns (currency in AED by default, percent, date), formulas, optional SUM total row, bold frozen header, filter, widths |
| `excel-spreadsheets/scripts/inspect_data.py` | profiles a sheet or CSV (any common encoding): columns, types, blanks, duplicates, sample; warns when formulas have no saved results |
| `powerpoint-slides/scripts/make_pptx.py` | JSON outline → 16:9 .pptx: title, section, bullets (2 levels), two-column, table, closing, speaker notes. Rescales the 4:3 default layouts, which python-pptx doesn't. |
| `pdf-files/scripts/read_pdf.py` | text page by page, `--tables` as Markdown, `--images` renders pages to PNG for scans, flags pages with no text |

The research skill uses goose's `uvx ddgs` route (DuckDuckGo search and page extraction, no API key),
checked working.

**4. Ready workspace** (`distro/launchers/`, `warmUpPython()`)
- `kz-python script.py` runs Python with openpyxl, python-docx, python-pptx, pypdf, pdfplumber and
  pandas through the bundled `uvx`. It passes `--directory "$PWD"`, which fixes the relative-path
  problem above. Both launchers must list the same libraries.
- The launchers folder is added to `PATH` in `applyDistroBundledEnv()`, after `Resources/bin`.
- 15 s after start-up, and once per app version until it succeeds, the app runs `kz-python` and
  `uvx ddgs` in the background, so the first real request doesn't wait. Success writes
  `<GOOSE_PATH_ROOT>/.kidzink-python-ready-<version>`. **This downloads about 630 MB the first time**
  (hermit, uv, Python 3.10 and the libraries); it needs internet and disk space.
- Verified on macOS in a throwaway profile. Not yet verified on Windows (`kz-python.cmd`, `uvx.exe`).
- Licences of the packages fetched at runtime (not bundled): openpyxl MIT, python-docx MIT,
  python-pptx MIT, pypdf BSD-3, pdfplumber MIT (with pypdfium2 Apache-2.0/BSD), pandas BSD-3, ddgs MIT.

**Checking it** (no API key needed): `distro/testing/check-knowhow.sh`. It confirms goose discovers
every skill, validates every recipe, and runs each helper script. Run it before every build.

**Not done yet: the real-model test set.** About 25 survey-based tasks run against the real model and
scored, before each release. This needs a test OpenRouter key.

### Phase 6 — lock-down and privacy ✅

**Admin mode** (`isDistroAdmin()` in `src/distro/mainProcess.ts`)
- On when `/Library/Application Support/Kidzink AI/admin.json` (macOS) or
  `%PROGRAMDATA%\Kidzink AI\admin.json` (Windows) exists. The content doesn't matter. Restart the
  app after adding or removing the file.
- The main process reports it to the renderer once, through a synchronous IPC call in `preload.ts`
  (`window.kidzink.isAdmin`, `src/distro/admin.ts`).
- Admin mode shows everything below again, lifts the OpenRouter-only provider filter, stops resetting
  the default provider and model, and skips the extension policy.

**Hidden from staff**
- **Sidebar** (`NavigationPanel.tsx` → `isDistroNavItemVisible`): Recipes, Skills, Apps, Scheduler,
  Extensions. Staff keep New Chat, Session History and Settings. The routes are guarded too
  (`<AdminOnly>` in `App.tsx`), because the `set-view` IPC and in-app links can still reach them.
- **Settings** (`SettingsView.tsx` imports its tab components from `src/distro/settingsTabs.tsx`):
  only the Chat, Keyboard and App tabs. Models, Local Inference, Agent, Prompts and Auth are hidden,
  and a deep link to a hidden tab opens Chat. The raw config editor on the App tab is admin-only.
- **Chat tab** (`ChatSettingsSection.tsx`): Default Mode, Goosehints and prompt-injection
  Security are admin-only. Voice, dictation, spellcheck and response styles stay.
- **The chat box's extension picker** (`ChatInput.tsx`).
- **Deep links:** `goose://extension` (the install modal isn't mounted, `App.tsx`) and
  `goose://recipe` / `goose://bot` (`parseRecipeDeeplink` in `main.ts` returns nothing, so a plain
  chat opens).
- **Custom providers:** unreachable for staff, since both the provider grid and the Models tab are hidden.

**Telemetry and outbound traffic**
- **PostHog** (backend, opt-in): forced off with `GOOSE_TELEMETRY_OFF=1` in `distroBackendEnv()`.
  `TELEMETRY_UI_ENABLED = false` hides the toggle and consent prompt.
  - Caveat: `posthog::emit_event` sends `onboarding_*` events **without** checking either switch.
    Nothing reaches it today: its only callers send `schedule_job_*` events, which it drops, and the
    desktop's analytics calls are no-ops. Recheck on upstream syncs (`grep -rn 'emit_event(' crates`).
  - Frontend analytics are upstream no-ops.
- **Update checks:** `UPDATES_ENABLED = false` (`updates.ts`), so the GitHub feed for
  `aaif-goose/goose` is never contacted and the update card is hidden.
- **Still on:**
  - OpenRouter, the only AI traffic.
  - The `api.osv.dev` malware lookup, but only for `npx`/`uvx` *extensions*, which staff can't add.
    It's a safety check, so it stays.
  - First-use downloads by `uvx`: hermit and uv from GitHub, packages from PyPI.
  - Langfuse and OTLP exporters only run when their env vars are set; nothing sets them.

**Secrets in the repo**
- `.gitignore` covers `.env.*` (except examples), `*.pem`, `*.p12`, `*.pfx`, `*.key`,
  `credentials.json` and `service-account*.json`. Upstream's tracked `ui/desktop/.env` holds no
  secrets and stays tracked.
- **Pre-commit hook** `distro/git-hooks/check-secrets.sh`. It uses gitleaks when installed,
  otherwise built-in patterns for OpenRouter, Anthropic, OpenAI, GitHub, AWS, Slack, Google and
  Stripe keys, private keys and Supabase secret keys. It also blocks secret-only files such as `.env`.
  - Enable it per clone: `git config core.hooksPath distro/git-hooks` (done on Adnan's clone).
  - Scan the whole repo: `distro/git-hooks/check-secrets.sh --all`.
  - Upstream test fixtures that look like keys are listed in `secret-scan-allowlist.txt`.

### Phase 7 — build, signing and updates (dropped 2026-10-05)

### Phase 8 — staff and IT documentation (dropped 2026-10-05)

## Testing the staff experience

With the mock running (`MOCK_DUMP_DIR=<dir> python3 distro/testing/mock_openrouter.py 8765 <log>`),
start a build with a throwaway profile, so neither your Keychain nor your real settings are touched:

```bash
ENABLE_PLAYWRIGHT=true PLAYWRIGHT_DEBUG_PORT=9333 OPENROUTER_HOST=http://127.0.0.1:8765 \
  GOOSE_PATH_ROOT=<tmp>/root GOOSE_DISABLE_KEYRING=1 \
  "ui/desktop/out/Kidzink AI-darwin-arm64/Kidzink AI.app/Contents/MacOS/Kidzink AI" --user-data-dir=<tmp>/ud --use-mock-keychain
PLAYWRIGHT_DEBUG_PORT=9333 OUT_DIR=<tmp> node distro/testing/drive-key-setup.js staff
```

The `staff` scenario checks the cards, the hidden sidebar items and Settings tabs, and the
`#/extensions` redirect, then starts a recipe. Add `--use-mock-keychain` to the app's arguments:
otherwise each rebuild's new ad-hoc signature makes macOS ask for Keychain access, and the app
waits on that dialog. `MOCK_DUMP_DIR` saves each model request, so you can
check which tools and instructions the model received.

## Licensing

- Upstream `LICENSE` (Apache 2.0) stays unchanged. Upstream has no `NOTICE` file. A short one
  crediting goose and describing our modifications was planned for Phase 8; with that phase
  dropped, it's still worth adding before wider distribution.
- Each modified upstream file gets a one-line header, `Modified by Kidzink for Kidzink AI`,
  and is listed in `distro/MODIFIED_UPSTREAM_FILES.txt`.
- The goose name and logo appear only in the About screen's "Powered by goose (open source)" credit.
- Every bundled third-party component goes in `THIRD_PARTY_LICENSES.md`. Anything not
  permissively licensed must be flagged before it is included.
