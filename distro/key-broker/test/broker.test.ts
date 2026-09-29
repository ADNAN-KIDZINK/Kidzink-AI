import { beforeEach, describe, expect, it } from 'vitest';
import {
  entitlementsForKey,
  signIn,
  sync,
  type BrokerDeps,
  type Entitlement,
  type IssuedKey,
  type ModelGroup,
  type Store,
} from '../supabase/functions/kidzink-ai-key/core.ts';
import { seal, sha256Hex, unseal } from '../supabase/functions/kidzink-ai-key/crypto.ts';
import {
  createOpenRouterAdmin,
  type KeyPatch,
  type OpenRouterAdmin,
} from '../supabase/functions/kidzink-ai-key/openrouter.ts';

const SECRET = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const ADNAN = { id: '00000000-0000-0000-0000-000000000001', email: 'Adnan@Kidzink.com' };

class MemoryStore implements Store {
  entitlements = new Map<string, Entitlement>();
  groups = new Map<string, ModelGroup>();
  keys = new Map<string, IssuedKey>();
  async getEntitlement(email: string) {
    return this.entitlements.get(email) ?? null;
  }
  async getModelGroup(code: string) {
    return this.groups.get(code) ?? null;
  }
  async listModelGroups() {
    return [...this.groups.values()];
  }
  async setGuardrailId(code: string, guardrailId: string) {
    this.groups.set(code, { ...this.groups.get(code)!, guardrailId });
  }
  async getIssuedKey(userId: string) {
    return this.keys.get(userId) ?? null;
  }
  async getIssuedKeyBySha256(keySha256: string) {
    return [...this.keys.values()].find((k) => k.keySha256 === keySha256) ?? null;
  }
  async listIssuedKeys() {
    return [...this.keys.values()];
  }
  async saveIssuedKey(key: IssuedKey) {
    this.keys.set(key.userId, key);
  }
}

class FakeOpenRouter implements OpenRouterAdmin {
  created: { name: string; limitUsd: number }[] = [];
  patches: { hash: string; patch: KeyPatch }[] = [];
  guardrails = new Map<string, string[]>();
  assignments = new Map<string, string>();
  async createKey(input: { name: string; limitUsd: number }) {
    this.created.push(input);
    const n = this.created.length;
    return { key: `sk-or-v1-issued-${n}`, hash: `hash-${n}` };
  }
  async updateKey(hash: string, patch: KeyPatch) {
    this.patches.push({ hash, patch });
  }
  async createGuardrail({ allowedModels }: { name: string; allowedModels: string[] }) {
    const id = `guardrail-${this.guardrails.size + 1}`;
    this.guardrails.set(id, allowedModels);
    return id;
  }
  async updateGuardrail(id: string, { allowedModels }: { allowedModels: string[] }) {
    this.guardrails.set(id, allowedModels);
  }
  async assignKeysToGuardrail(guardrailId: string, keyHashes: string[]) {
    for (const hash of keyHashes) this.assignments.set(hash, guardrailId);
  }
  async canonicalSlugs(modelIds: string[]) {
    return modelIds.map((id) => `${id}-canonical`);
  }
}

let store: MemoryStore;
let openrouter: FakeOpenRouter;
let deps: BrokerDeps;

beforeEach(() => {
  store = new MemoryStore();
  openrouter = new FakeOpenRouter();
  deps = { store, openrouter, encryptionSecret: SECRET, allowedEmailDomains: ['kidzink.com'] };
  store.groups.set('standard', {
    code: 'standard',
    name: 'Standard',
    models: ['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5'],
    defaultModel: 'anthropic/claude-sonnet-5',
    guardrailId: null,
  });
  store.groups.set('power', {
    code: 'power',
    name: 'Power',
    models: ['anthropic/claude-opus-5.5'],
    defaultModel: 'anthropic/claude-opus-5.5',
    guardrailId: null,
  });
  store.entitlements.set('adnan@kidzink.com', {
    email: 'adnan@kidzink.com',
    monthlyLimitUsd: 10,
    modelGroup: 'standard',
    enabled: true,
  });
});

describe('signIn', () => {
  it('issues a key with the person’s limit and group guardrail on first sign-in', async () => {
    const result = await signIn(deps, ADNAN);
    expect(result).toEqual({
      ok: true,
      value: {
        key: 'sk-or-v1-issued-1',
        email: 'adnan@kidzink.com',
        models: ['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5'],
        defaultModel: 'anthropic/claude-sonnet-5',
        monthlyLimitUsd: 10,
      },
    });
    expect(openrouter.created).toEqual([{ name: 'kidzink-ai:adnan@kidzink.com', limitUsd: 10 }]);
    expect(openrouter.guardrails.get('guardrail-1')).toEqual([
      'anthropic/claude-sonnet-5-canonical',
      'anthropic/claude-haiku-4.5-canonical',
    ]);
    expect(openrouter.assignments.get('hash-1')).toBe('guardrail-1');
    expect(store.groups.get('standard')!.guardrailId).toBe('guardrail-1');
  });

  it('stores the key encrypted, never in plain text', async () => {
    await signIn(deps, ADNAN);
    const issued = store.keys.get(ADNAN.id)!;
    expect(JSON.stringify(issued)).not.toContain('sk-or-v1-issued-1');
    expect(await unseal({ ciphertext: issued.keyCiphertext, iv: issued.keyIv }, SECRET)).toBe(
      'sk-or-v1-issued-1',
    );
    expect(issued.keySha256).toBe(await sha256Hex('sk-or-v1-issued-1'));
  });

  it('returns the same key on a second sign-in so the monthly budget cannot be reset', async () => {
    await signIn(deps, ADNAN);
    const again = await signIn(deps, ADNAN);
    expect(again.ok && again.value.key).toBe('sk-or-v1-issued-1');
    expect(openrouter.created).toHaveLength(1);
  });

  it('applies limit and group changes to the existing key', async () => {
    await signIn(deps, ADNAN);
    store.entitlements.set('adnan@kidzink.com', {
      email: 'adnan@kidzink.com',
      monthlyLimitUsd: 25,
      modelGroup: 'power',
      enabled: true,
    });
    const result = await signIn(deps, ADNAN);
    expect(result.ok && result.value.models).toEqual(['anthropic/claude-opus-5.5']);
    expect(openrouter.patches).toContainEqual({
      hash: 'hash-1',
      patch: { disabled: false, limit: 25, limit_reset: 'monthly' },
    });
    expect(openrouter.assignments.get('hash-1')).toBe('guardrail-2');
    expect(store.keys.get(ADNAN.id)!.limitUsd).toBe(25);
  });

  it('refuses people who are not on the staff list', async () => {
    const result = await signIn(deps, { id: 'u2', email: 'new.person@kidzink.com' });
    expect(result).toMatchObject({ ok: false, status: 403, code: 'not_enabled' });
    expect(openrouter.created).toHaveLength(0);
  });

  it('refuses disabled entitlements', async () => {
    store.entitlements.get('adnan@kidzink.com')!.enabled = false;
    expect(await signIn(deps, ADNAN)).toMatchObject({ ok: false, code: 'not_enabled' });
  });

  it('refuses accounts outside the allowed email domains', async () => {
    const result = await signIn(deps, { id: 'u3', email: 'someone@gmail.com' });
    expect(result).toMatchObject({ ok: false, code: 'wrong_domain' });
  });

  it('re-enables a key that the sync disabled once the person is back on the list', async () => {
    await signIn(deps, ADNAN);
    store.keys.set(ADNAN.id, { ...store.keys.get(ADNAN.id)!, disabled: true });
    await signIn(deps, ADNAN);
    expect(openrouter.patches).toContainEqual({ hash: 'hash-1', patch: { disabled: false } });
    expect(store.keys.get(ADNAN.id)!.disabled).toBe(false);
  });
});

describe('entitlementsForKey', () => {
  it('returns current models and limit for a known key', async () => {
    await signIn(deps, ADNAN);
    const result = await entitlementsForKey(deps, await sha256Hex('sk-or-v1-issued-1'));
    expect(result).toMatchObject({
      ok: true,
      value: { email: 'adnan@kidzink.com', monthlyLimitUsd: 10 },
    });
  });

  it('tells the app to sign out when the person was removed', async () => {
    await signIn(deps, ADNAN);
    store.entitlements.delete('adnan@kidzink.com');
    const result = await entitlementsForKey(deps, await sha256Hex('sk-or-v1-issued-1'));
    expect(result).toMatchObject({ ok: false, code: 'not_enabled' });
  });

  it('rejects unknown keys', async () => {
    expect(await entitlementsForKey(deps, 'a'.repeat(64))).toMatchObject({
      ok: false,
      code: 'unknown_key',
    });
  });
});

describe('sync', () => {
  it('disables keys of people removed from the list and updates guardrails', async () => {
    await signIn(deps, ADNAN);
    store.entitlements.delete('adnan@kidzink.com');
    store.groups.set('standard', {
      ...store.groups.get('standard')!,
      models: ['anthropic/claude-haiku-4.5'],
    });
    const report = await sync(deps);
    expect(report.keysDisabled).toEqual(['adnan@kidzink.com']);
    expect(report.guardrailsUpdated).toEqual(['standard']);
    expect(openrouter.guardrails.get('guardrail-1')).toEqual([
      'anthropic/claude-haiku-4.5-canonical',
    ]);
    expect(openrouter.patches).toContainEqual({ hash: 'hash-1', patch: { disabled: true } });
    expect((await sync(deps)).keysDisabled).toEqual([]);
  });
});

describe('crypto', () => {
  it('rejects secrets that are not 32 bytes', async () => {
    await expect(seal('x', btoa('short'))).rejects.toThrow('32 bytes');
  });
});

describe('createOpenRouterAdmin', () => {
  it('sends management-key requests and maps canonical slugs', async () => {
    const calls: { method: string; url: string; body?: string; auth?: string }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({
        method: init.method!,
        url,
        body: init.body as string | undefined,
        auth: (init.headers as Record<string, string>).Authorization,
      });
      if (url.endsWith('/keys')) {
        return new Response(JSON.stringify({ key: 'sk-or-v1-new', data: { hash: 'h1' } }), {
          status: 201,
        });
      }
      if (url.endsWith('/models')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'anthropic/claude-haiku-4.5',
                canonical_slug: 'anthropic/claude-4.5-haiku-20251001',
              },
            ],
          }),
        );
      }
      return new Response(JSON.stringify({ error: { message: 'Forbidden' } }), { status: 403 });
    }) as typeof fetch;

    const admin = createOpenRouterAdmin('mgmt-key', 'https://example.test/api/v1', fakeFetch);
    expect(await admin.createKey({ name: 'kidzink-ai:a@kidzink.com', limitUsd: 5 })).toEqual({
      key: 'sk-or-v1-new',
      hash: 'h1',
    });
    expect(JSON.parse(calls[0].body!)).toEqual({
      name: 'kidzink-ai:a@kidzink.com',
      limit: 5,
      limit_reset: 'monthly',
    });
    expect(calls[0].auth).toBe('Bearer mgmt-key');
    expect(await admin.canonicalSlugs(['anthropic/claude-haiku-4.5'])).toEqual([
      'anthropic/claude-4.5-haiku-20251001',
    ]);
    await expect(admin.canonicalSlugs(['made/up'])).rejects.toThrow('Unknown OpenRouter model ids');
    await expect(admin.updateKey('h1', { disabled: true })).rejects.toThrow('403');
  });
});
