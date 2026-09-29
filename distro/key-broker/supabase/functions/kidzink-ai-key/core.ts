// Kidzink AI key broker: turns a signed-in Kidzink account into that person's OpenRouter key.
// Runtime-agnostic: index.ts wires it to Supabase on Deno, the tests wire it to in-memory fakes.
import { seal, sha256Hex, unseal } from './crypto.ts';
import type { OpenRouterAdmin } from './openrouter.ts';

export interface Entitlement {
  email: string;
  monthlyLimitUsd: number;
  modelGroup: string;
  enabled: boolean;
}

export interface ModelGroup {
  code: string;
  name: string;
  models: string[];
  defaultModel: string;
  guardrailId: string | null;
}

export interface IssuedKey {
  userId: string;
  email: string;
  openrouterKeyHash: string;
  keySha256: string;
  keyCiphertext: string;
  keyIv: string;
  limitUsd: number;
  modelGroup: string;
  disabled: boolean;
}

export interface Store {
  getEntitlement(email: string): Promise<Entitlement | null>;
  getModelGroup(code: string): Promise<ModelGroup | null>;
  listModelGroups(): Promise<ModelGroup[]>;
  setGuardrailId(code: string, guardrailId: string): Promise<void>;
  getIssuedKey(userId: string): Promise<IssuedKey | null>;
  getIssuedKeyBySha256(keySha256: string): Promise<IssuedKey | null>;
  listIssuedKeys(): Promise<IssuedKey[]>;
  saveIssuedKey(key: IssuedKey): Promise<void>;
}

export interface BrokerDeps {
  store: Store;
  openrouter: OpenRouterAdmin;
  encryptionSecret: string;
  allowedEmailDomains: string[];
}

export interface SignedInUser {
  id: string;
  email: string;
}

export interface Access {
  email: string;
  models: string[];
  defaultModel: string;
  monthlyLimitUsd: number;
}

export type BrokerResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      status: 403;
      code: 'wrong_domain' | 'not_enabled' | 'unknown_key';
      message: string;
    };

const NOT_ENABLED_MESSAGE =
  "Kidzink AI isn't turned on for your account yet. Ask IT to add you to the Kidzink AI staff list.";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function keyName(email: string): string {
  return `kidzink-ai:${email}`;
}

function guardrailName(group: ModelGroup): string {
  return `Kidzink AI - ${group.name}`;
}

async function ensureGuardrail(deps: BrokerDeps, group: ModelGroup): Promise<string> {
  if (group.guardrailId) return group.guardrailId;
  const allowedModels = await deps.openrouter.canonicalSlugs(group.models);
  const id = await deps.openrouter.createGuardrail({ name: guardrailName(group), allowedModels });
  await deps.store.setGuardrailId(group.code, id);
  return id;
}

async function activeEntitlement(
  deps: BrokerDeps,
  email: string,
): Promise<{ entitlement: Entitlement; group: ModelGroup } | null> {
  const entitlement = await deps.store.getEntitlement(email);
  if (!entitlement?.enabled) return null;
  const group = await deps.store.getModelGroup(entitlement.modelGroup);
  if (!group) return null;
  return { entitlement, group };
}

function access(email: string, entitlement: Entitlement, group: ModelGroup): Access {
  return {
    email,
    models: group.models,
    defaultModel: group.defaultModel,
    monthlyLimitUsd: entitlement.monthlyLimitUsd,
  };
}

// Brings an existing OpenRouter key in line with the staff list: enabled, current limit, current group.
async function reconcileKey(
  deps: BrokerDeps,
  issued: IssuedKey,
  entitlement: Entitlement,
  group: ModelGroup,
): Promise<IssuedKey> {
  const limitChanged = issued.limitUsd !== entitlement.monthlyLimitUsd;
  if (issued.disabled || limitChanged) {
    await deps.openrouter.updateKey(issued.openrouterKeyHash, {
      disabled: false,
      ...(limitChanged ? { limit: entitlement.monthlyLimitUsd, limit_reset: 'monthly' } : {}),
    });
  }
  if (issued.modelGroup !== group.code) {
    const guardrailId = await ensureGuardrail(deps, group);
    await deps.openrouter.assignKeysToGuardrail(guardrailId, [issued.openrouterKeyHash]);
  }
  const updated = {
    ...issued,
    disabled: false,
    limitUsd: entitlement.monthlyLimitUsd,
    modelGroup: group.code,
  };
  if (issued.disabled || limitChanged || issued.modelGroup !== group.code) {
    await deps.store.saveIssuedKey(updated);
  }
  return updated;
}

export async function signIn(
  deps: BrokerDeps,
  user: SignedInUser,
): Promise<BrokerResult<Access & { key: string }>> {
  const email = normalizeEmail(user.email);
  const domain = email.split('@')[1] ?? '';
  if (!deps.allowedEmailDomains.includes(domain)) {
    return {
      ok: false,
      status: 403,
      code: 'wrong_domain',
      message: 'Sign in with your Kidzink Microsoft account.',
    };
  }

  const active = await activeEntitlement(deps, email);
  if (!active) {
    return { ok: false, status: 403, code: 'not_enabled', message: NOT_ENABLED_MESSAGE };
  }
  const { entitlement, group } = active;

  const issued = await deps.store.getIssuedKey(user.id);
  if (issued) {
    // Handing back the same key keeps this month's spend on it, so signing in again (or on a
    // second laptop) can't reset anyone's budget.
    await reconcileKey(deps, issued, entitlement, group);
    const key = await unseal(
      { ciphertext: issued.keyCiphertext, iv: issued.keyIv },
      deps.encryptionSecret,
    );
    return { ok: true, value: { ...access(email, entitlement, group), key } };
  }

  const guardrailId = await ensureGuardrail(deps, group);
  const created = await deps.openrouter.createKey({
    name: keyName(email),
    limitUsd: entitlement.monthlyLimitUsd,
  });
  await deps.openrouter.assignKeysToGuardrail(guardrailId, [created.hash]);
  const sealed = await seal(created.key, deps.encryptionSecret);
  await deps.store.saveIssuedKey({
    userId: user.id,
    email,
    openrouterKeyHash: created.hash,
    keySha256: await sha256Hex(created.key),
    keyCiphertext: sealed.ciphertext,
    keyIv: sealed.iv,
    limitUsd: entitlement.monthlyLimitUsd,
    modelGroup: group.code,
    disabled: false,
  });
  return { ok: true, value: { ...access(email, entitlement, group), key: created.key } };
}

// Called by the app at startup with a hash of the key it holds, so model-list and limit changes
// reach people without another sign-in, and removed staff are signed out.
export async function entitlementsForKey(
  deps: BrokerDeps,
  keySha256: string,
): Promise<BrokerResult<Access>> {
  const issued = await deps.store.getIssuedKeyBySha256(keySha256);
  if (!issued) {
    return { ok: false, status: 403, code: 'unknown_key', message: 'Please sign in again.' };
  }
  const active = await activeEntitlement(deps, issued.email);
  if (!active) {
    return { ok: false, status: 403, code: 'not_enabled', message: NOT_ENABLED_MESSAGE };
  }
  await reconcileKey(deps, issued, active.entitlement, active.group);
  return { ok: true, value: access(issued.email, active.entitlement, active.group) };
}

export interface SyncReport {
  guardrailsUpdated: string[];
  keysDisabled: string[];
  keysUpdated: string[];
  errors: string[];
}

// Daily job: push model-group changes to their guardrails and apply the staff list to every key.
export async function sync(deps: BrokerDeps): Promise<SyncReport> {
  const report: SyncReport = {
    guardrailsUpdated: [],
    keysDisabled: [],
    keysUpdated: [],
    errors: [],
  };

  for (const group of await deps.store.listModelGroups()) {
    try {
      if (group.guardrailId) {
        const allowedModels = await deps.openrouter.canonicalSlugs(group.models);
        await deps.openrouter.updateGuardrail(group.guardrailId, { allowedModels });
        report.guardrailsUpdated.push(group.code);
      }
    } catch (error) {
      report.errors.push(`group ${group.code}: ${String(error)}`);
    }
  }

  for (const issued of await deps.store.listIssuedKeys()) {
    try {
      const active = await activeEntitlement(deps, issued.email);
      if (!active) {
        if (!issued.disabled) {
          await deps.openrouter.updateKey(issued.openrouterKeyHash, { disabled: true });
          await deps.store.saveIssuedKey({ ...issued, disabled: true });
          report.keysDisabled.push(issued.email);
        }
        continue;
      }
      const updated = await reconcileKey(deps, issued, active.entitlement, active.group);
      if (
        updated.limitUsd !== issued.limitUsd ||
        updated.modelGroup !== issued.modelGroup ||
        issued.disabled
      ) {
        report.keysUpdated.push(issued.email);
      }
    } catch (error) {
      report.errors.push(`${issued.email}: ${String(error)}`);
    }
  }
  return report;
}
