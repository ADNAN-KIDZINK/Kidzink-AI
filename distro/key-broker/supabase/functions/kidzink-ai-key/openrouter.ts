// OpenRouter management API (https://openrouter.ai/openapi.json). Uses a management key, which
// can create, change and delete API keys but cannot run completions.

export interface CreatedKey {
  key: string;
  hash: string;
}

export interface KeyPatch {
  limit?: number;
  limit_reset?: 'daily' | 'weekly' | 'monthly' | null;
  disabled?: boolean;
  name?: string;
}

export interface OpenRouterAdmin {
  createKey(input: { name: string; limitUsd: number }): Promise<CreatedKey>;
  updateKey(hash: string, patch: KeyPatch): Promise<void>;
  createGuardrail(input: { name: string; allowedModels: string[] }): Promise<string>;
  updateGuardrail(id: string, input: { allowedModels: string[] }): Promise<void>;
  assignKeysToGuardrail(guardrailId: string, keyHashes: string[]): Promise<void>;
  // Guardrail allowlists take canonical slugs (e.g. anthropic/claude-4.5-haiku-20251001),
  // which differ from the model ids the app requests (anthropic/claude-haiku-4.5).
  canonicalSlugs(modelIds: string[]): Promise<string[]>;
}

export class OpenRouterApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OpenRouterApiError';
  }
}

export function createOpenRouterAdmin(
  managementKey: string,
  baseUrl = 'https://openrouter.ai/api/v1',
  fetchImpl: typeof fetch = fetch,
): OpenRouterAdmin {
  const root = baseUrl.replace(/\/+$/, '');

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${managementKey}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        message = JSON.parse(text)?.error?.message ?? text;
      } catch {
        // non-JSON error body; keep the raw text
      }
      throw new OpenRouterApiError(
        response.status,
        `${method} ${path} failed (${response.status}): ${message}`,
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  return {
    async createKey({ name, limitUsd }) {
      const result = await call<{ key: string; data: { hash: string } }>('POST', '/keys', {
        name,
        limit: limitUsd,
        limit_reset: 'monthly',
      });
      return { key: result.key, hash: result.data.hash };
    },

    async updateKey(hash, patch) {
      await call('PATCH', `/keys/${encodeURIComponent(hash)}`, patch);
    },

    async createGuardrail({ name, allowedModels }) {
      const result = await call<{ data: { id: string } }>('POST', '/guardrails', {
        name,
        allowed_models: allowedModels,
      });
      return result.data.id;
    },

    async updateGuardrail(id, { allowedModels }) {
      await call('PATCH', `/guardrails/${encodeURIComponent(id)}`, {
        allowed_models: allowedModels,
      });
    },

    async assignKeysToGuardrail(guardrailId, keyHashes) {
      await call('POST', `/guardrails/${encodeURIComponent(guardrailId)}/assignments/keys`, {
        key_hashes: keyHashes,
      });
    },

    async canonicalSlugs(modelIds) {
      const { data } = await call<{ data: { id: string; canonical_slug?: string | null }[] }>(
        'GET',
        '/models',
      );
      const byId = new Map(data.map((model) => [model.id, model.canonical_slug || model.id]));
      const unknown = modelIds.filter((id) => !byId.has(id));
      if (unknown.length > 0) {
        throw new Error(`Unknown OpenRouter model ids: ${unknown.join(', ')}`);
      }
      return modelIds.map((id) => byId.get(id)!);
    },
  };
}
