// Supabase Edge Function entry point. Routes:
//   POST /kidzink-ai-key/sign-in       Authorization: Bearer <user's Supabase access token>
//   POST /kidzink-ai-key/entitlements  body { key_sha256 }
//   POST /kidzink-ai-key/sync          header X-Cron-Secret: <CRON_SECRET>
// Deployed with verify_jwt = false (see ../../config.toml): every route checks its own credential.
// See ../../../README.md for secrets and deployment.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { entitlementsForKey, signIn, sync, type BrokerDeps, type BrokerResult } from './core.ts';
import { createOpenRouterAdmin } from './openrouter.ts';
import { createSupabaseStore } from './store.ts';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function reply<T>(result: BrokerResult<T>): Response {
  return result.ok
    ? json(200, result.value)
    : json(result.status, { error: result.code, message: result.message });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const route = new URL(req.url).pathname.split('/').pop();

  try {
    const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
    const deps: BrokerDeps = {
      store: createSupabaseStore(supabase),
      openrouter: createOpenRouterAdmin(required('OPENROUTER_MANAGEMENT_KEY')),
      encryptionSecret: required('KEY_ENCRYPTION_SECRET'),
      allowedEmailDomains: (Deno.env.get('ALLOWED_EMAIL_DOMAINS') ?? 'kidzink.com')
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    };

    if (route === 'sign-in') {
      const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user?.email) {
        return json(401, { error: 'not_signed_in', message: 'Please sign in again.' });
      }
      return reply(await signIn(deps, { id: data.user.id, email: data.user.email }));
    }

    if (route === 'entitlements') {
      const body = (await req.json().catch(() => ({}))) as { key_sha256?: unknown };
      if (typeof body.key_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(body.key_sha256)) {
        return json(400, { error: 'bad_request' });
      }
      return reply(await entitlementsForKey(deps, body.key_sha256));
    }

    if (route === 'sync') {
      if (!timingSafeEqual(req.headers.get('X-Cron-Secret') ?? '', required('CRON_SECRET'))) {
        return json(401, { error: 'unauthorized' });
      }
      return json(200, await sync(deps));
    }

    return json(404, { error: 'not_found' });
  } catch (error) {
    // Never echo request bodies or keys; the message comes from our own code or OpenRouter.
    console.error(
      `kidzink-ai-key ${route} failed:`,
      error instanceof Error ? error.message : error,
    );
    return json(500, {
      error: 'server_error',
      message: 'Something went wrong. Try again in a minute.',
    });
  }
});
