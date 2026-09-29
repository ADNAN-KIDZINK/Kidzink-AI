# Kidzink AI key broker

Staff sign in to Kidzink AI with their Kidzink Microsoft account, through the shared Kidzink
Supabase project (`hxpabclqbqrukmfqdahz`), the same sign-in Kompass and the quotation app use.
This Supabase Edge Function then gives the app that person's own OpenRouter API key. Staff never
see or paste a key.

```
App ──(Supabase session)──▶ kidzink-ai-key/sign-in ──▶ kidzink_ai.entitlements (staff list)
                                    │                      kidzink_ai.model_groups
                                    ▼
                        OpenRouter management API: one key per person,
                        monthly limit, group guardrail (model allowlist)
```

- **One key per person**, named `kidzink-ai:<email>`, with `limit` set to their monthly budget
  and `limit_reset: monthly`. When it runs out, OpenRouter returns 402 and the app shows
  "You've reached your AI usage limit…".
- **One OpenRouter guardrail per model group** (`Kidzink AI - <group name>`) holds the model
  allowlist. OpenRouter enforces it, so a key can't use other models even outside the app.
- **Keys are stored encrypted** (AES-256-GCM, secret held outside the database), so signing in
  again or on a second laptop returns the same key. A fresh key would reset the month's spend.
- **Removing someone from the staff list switches them off.** Their app signs out at its next
  start, and the daily sync disables their key.

## Files

| Path | What |
|---|---|
| `sql/01-kidzink-ai-schema.sql` | `kidzink_ai` schema: `model_groups`, `entitlements`, `issued_keys`, RLS |
| `sql/02-schedule-daily-sync.sql` | pg_cron job calling `/sync` daily |
| `supabase/functions/kidzink-ai-key/` | The Edge Function. `core.ts` holds the logic, `index.ts` the routes. |
| `supabase/config.toml` | `verify_jwt = false`, because each route checks its own credential |
| `test/broker.test.ts` | Unit tests (in-memory store, fake OpenRouter) |

## Routes

| Route | Credential | Returns |
|---|---|---|
| `POST /functions/v1/kidzink-ai-key/sign-in` | `Authorization: Bearer <user's Supabase access token>` | `{ key, email, models, defaultModel, monthlyLimitUsd }` |
| `POST /functions/v1/kidzink-ai-key/entitlements` | body `{ "key_sha256": "<sha256 of the key the app holds>" }` | `{ email, models, defaultModel, monthlyLimitUsd }` |
| `POST /functions/v1/kidzink-ai-key/sync` | header `X-Cron-Secret` | report of guardrails updated and keys disabled or updated |

Refusals are `403 { error, message }`, where `error` is one of:
- `wrong_domain`: not an allowed email domain
- `not_enabled`: not on the staff list, or `enabled = false`
- `unknown_key`: the app should sign in again

## One-time setup

Whoever administers the shared Supabase project does this. Nothing here changes existing schemas.

1. **OpenRouter**
   1. Create the Kidzink organization (Settings → Preferences → Organization) and add credit.
   2. Create a **management key** (Settings → Management Keys), **with an expiry date**. It can
      create and delete every key in the organization, so it only ever goes into step 3.
2. **Database:** run `sql/01-kidzink-ai-schema.sql` in the SQL editor. Then add `kidzink_ai` under
   **Project Settings → API → Exposed schemas**.
3. **Secrets:**
   ```bash
   supabase login
   supabase link --project-ref hxpabclqbqrukmfqdahz
   supabase secrets set OPENROUTER_MANAGEMENT_KEY=<management key>
   supabase secrets set KEY_ENCRYPTION_SECRET="$(openssl rand -base64 32)"
   supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
   # optional, default kidzink.com:
   # supabase secrets set ALLOWED_EMAIL_DOMAINS=kidzink.com
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.
   **Never rotate or lose `KEY_ENCRYPTION_SECRET`.** Stored keys can't be decrypted without it.
   If it's lost, clear `kidzink_ai.issued_keys` and people get new keys at their next sign-in.
4. **Deploy:**
   ```bash
   cd distro/key-broker
   supabase functions deploy kidzink-ai-key --no-verify-jwt
   ```
5. **Daily sync:** enable `pg_cron` and `pg_net` (Database → Extensions), put the `CRON_SECRET`
   value into `sql/02-schedule-daily-sync.sql` **locally**, run it, and don't commit it.
6. **Sign-in redirect:** add the app's local callback to **Authentication → URL Configuration →
   Redirect URLs**: `http://127.0.0.1:53682/auth/callback`.
7. **App registry:** register Kidzink AI in `kidzink_auth.apps` the way the other apps are
   registered. Check with kidzink-auth's adoption checklist; the broker doesn't depend on it.

## Everyday admin (Supabase Table Editor → schema `kidzink_ai`)

- **Model groups** (`model_groups`): `code` (for example `standard`), `name`, `models` (OpenRouter
  model ids such as `anthropic/claude-sonnet-5`, exactly as listed on openrouter.ai/models),
  `default_model` (must be one of `models`). Leave `guardrail_id` empty; the broker fills it in.
  Model changes reach OpenRouter at the next daily sync.
- **Staff** (`entitlements`): one row per person, with `email` (lowercase), `monthly_limit_usd`,
  `model_group` and `enabled`. Changes apply at that person's next app start, or by the daily
  sync at the latest.
- **Leavers:** delete the row, or set `enabled = false`.
- **Usage:** the OpenRouter Activity page, grouped by API key (the key names are
  `kidzink-ai:<email>`).

Only people with the `admin` role in `kidzink_auth` can edit these tables. Staff can read only
their own entitlement. `issued_keys` is readable only by the Edge Function.

## Tests

```bash
cd distro/key-broker
../../ui/node_modules/.bin/vitest run
../../ui/node_modules/.bin/tsc -p .   # typechecks core, crypto, openrouter and tests (index/store need Deno)
```
