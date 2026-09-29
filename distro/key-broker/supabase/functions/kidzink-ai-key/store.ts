import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Entitlement, IssuedKey, ModelGroup, Store } from './core.ts';

// Service-role access to the kidzink_ai schema (it bypasses RLS; issued_keys has no client policies).
// The schema must be listed under Project Settings -> API -> Exposed schemas.
export function createSupabaseStore(supabase: SupabaseClient): Store {
  const db = supabase.schema('kidzink_ai');

  function check<T>(result: { data: T; error: { message: string } | null }): T {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  const toGroup = (row: Record<string, unknown>): ModelGroup => ({
    code: row.code as string,
    name: row.name as string,
    models: row.models as string[],
    defaultModel: row.default_model as string,
    guardrailId: (row.guardrail_id as string | null) ?? null,
  });

  const toIssued = (row: Record<string, unknown>): IssuedKey => ({
    userId: row.user_id as string,
    email: row.email as string,
    openrouterKeyHash: row.openrouter_key_hash as string,
    keySha256: row.key_sha256 as string,
    keyCiphertext: row.key_ciphertext as string,
    keyIv: row.key_iv as string,
    limitUsd: Number(row.limit_usd),
    modelGroup: row.model_group as string,
    disabled: row.disabled as boolean,
  });

  return {
    async getEntitlement(email) {
      const row = check(await db.from('entitlements').select('*').eq('email', email).maybeSingle());
      if (!row) return null;
      return {
        email: row.email,
        monthlyLimitUsd: Number(row.monthly_limit_usd),
        modelGroup: row.model_group,
        enabled: row.enabled,
      } satisfies Entitlement;
    },

    async getModelGroup(code) {
      const row = check(await db.from('model_groups').select('*').eq('code', code).maybeSingle());
      return row ? toGroup(row) : null;
    },

    async listModelGroups() {
      return (check(await db.from('model_groups').select('*')) ?? []).map(toGroup);
    },

    async setGuardrailId(code, guardrailId) {
      check(await db.from('model_groups').update({ guardrail_id: guardrailId }).eq('code', code));
    },

    async getIssuedKey(userId) {
      const row = check(
        await db.from('issued_keys').select('*').eq('user_id', userId).maybeSingle(),
      );
      return row ? toIssued(row) : null;
    },

    async getIssuedKeyBySha256(keySha256) {
      const row = check(
        await db.from('issued_keys').select('*').eq('key_sha256', keySha256).maybeSingle(),
      );
      return row ? toIssued(row) : null;
    },

    async listIssuedKeys() {
      return (check(await db.from('issued_keys').select('*')) ?? []).map(toIssued);
    },

    async saveIssuedKey(key) {
      check(
        await db.from('issued_keys').upsert({
          user_id: key.userId,
          email: key.email,
          openrouter_key_hash: key.openrouterKeyHash,
          key_sha256: key.keySha256,
          key_ciphertext: key.keyCiphertext,
          key_iv: key.keyIv,
          limit_usd: key.limitUsd,
          model_group: key.modelGroup,
          disabled: key.disabled,
        }),
      );
    },
  };
}
