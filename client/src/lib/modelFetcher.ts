/* =============================================================
   modelFetcher.ts — Fetch live model lists from provider APIs.

   Supports: OpenRouter (public), OpenAI, Anthropic, Gemini, Venice, LMStudio.
   Falls back to static list if API is unreachable or key is missing.
   Results are cached in sessionStorage to avoid repeated fetches.
   ============================================================= */

export interface ModelOption {
  id: string;
  name: string;
  context_length?: number;
  input_cost_per_million?: number;   // USD
  output_cost_per_million?: number;  // USD
  description?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(provider: string) {
  return `orchestra_models_${provider}`;
}

function readCache(provider: string): ModelOption[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(provider));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data as ModelOption[];
  } catch {
    return null;
  }
}

function writeCache(provider: string, data: ModelOption[]) {
  try {
    sessionStorage.setItem(cacheKey(provider), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

// ─── OpenRouter (public, no key required) ──────────────────────────────────
async function fetchOpenRouterModels(): Promise<ModelOption[]> {
  const cached = readCache('openrouter');
  if (cached) return cached;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'HTTP-Referer': 'https://orchestra.ai', 'X-Title': 'Orchestra Dashboard' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const models: ModelOption[] = (json.data || [])
      .filter((m: Record<string, unknown>) => m.id)
      .map((m: Record<string, unknown>) => {
        const pricing = (m.pricing as Record<string, string>) || {};
        const inputPer1M = pricing.prompt ? parseFloat(pricing.prompt) * 1_000_000 : undefined;
        const outputPer1M = pricing.completion ? parseFloat(pricing.completion) * 1_000_000 : undefined;
        return {
          id: m.id as string,
          name: (m.name as string) || (m.id as string),
          context_length: (m.context_length as number) || undefined,
          input_cost_per_million: inputPer1M && isFinite(inputPer1M) ? Math.round(inputPer1M * 100) / 100 : undefined,
          output_cost_per_million: outputPer1M && isFinite(outputPer1M) ? Math.round(outputPer1M * 100) / 100 : undefined,
          description: (m.description as string) || undefined,
        };
      })
      .sort((a: ModelOption, b: ModelOption) => a.id.localeCompare(b.id));
    writeCache('openrouter', models);
    return models;
  } catch (e) {
    console.warn('[modelFetcher] OpenRouter fetch failed:', e);
    return [];
  }
}

// ─── OpenAI ────────────────────────────────────────────────────────────────
async function fetchOpenAIModels(apiKey: string): Promise<ModelOption[]> {
  const cacheId = `openai_${apiKey.slice(-8)}`;
  const cached = readCache(cacheId);
  if (cached) return cached;
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Filter to chat-capable models only
    const chatModels = (json.data || [])
      .filter((m: Record<string, unknown>) => {
        const id = (m.id as string) || '';
        return id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt');
      })
      .map((m: Record<string, unknown>) => ({
        id: m.id as string,
        name: (m.id as string).replace(/-/g, ' '),
      }))
      .sort((a: ModelOption, b: ModelOption) => b.id.localeCompare(a.id)); // newest first
    writeCache(cacheId, chatModels);
    return chatModels;
  } catch (e) {
    console.warn('[modelFetcher] OpenAI fetch failed:', e);
    return [];
  }
}

// ─── Anthropic ─────────────────────────────────────────────────────────────
async function fetchAnthropicModels(apiKey: string): Promise<ModelOption[]> {
  const cacheId = `anthropic_${apiKey.slice(-8)}`;
  const cached = readCache(cacheId);
  if (cached) return cached;
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const models: ModelOption[] = (json.data || [])
      .map((m: Record<string, unknown>) => ({
        id: m.id as string,
        name: (m.display_name as string) || (m.id as string),
        context_length: (m.context_window as number) || undefined,
      }))
      .sort((a: ModelOption, b: ModelOption) => b.id.localeCompare(a.id));
    writeCache(cacheId, models);
    return models;
  } catch (e) {
    console.warn('[modelFetcher] Anthropic fetch failed:', e);
    return [];
  }
}

// ─── Google Gemini ─────────────────────────────────────────────────────────
async function fetchGeminiModels(apiKey: string): Promise<ModelOption[]> {
  const cacheId = `gemini_${apiKey.slice(-8)}`;
  const cached = readCache(cacheId);
  if (cached) return cached;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const models: ModelOption[] = (json.models || [])
      .filter((m: Record<string, unknown>) => {
        const methods = (m.supportedGenerationMethods as string[]) || [];
        return methods.includes('generateContent');
      })
      .map((m: Record<string, unknown>) => {
        // name is "models/gemini-2.0-flash" → strip prefix
        const fullName = (m.name as string) || '';
        const id = fullName.replace('models/', '');
        return {
          id,
          name: (m.displayName as string) || id,
          context_length: (m.inputTokenLimit as number) || undefined,
        };
      })
      .sort((a: ModelOption, b: ModelOption) => b.id.localeCompare(a.id));
    writeCache(cacheId, models);
    return models;
  } catch (e) {
    console.warn('[modelFetcher] Gemini fetch failed:', e);
    return [];
  }
}

// ─── Venice.ai ─────────────────────────────────────────────────────────────
async function fetchVeniceModels(apiKey: string): Promise<ModelOption[]> {
  const cacheId = `venice_${apiKey.slice(-8)}`;
  const cached = readCache(cacheId);
  if (cached) return cached;
  try {
    const res = await fetch('https://api.venice.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const models: ModelOption[] = (json.data || [])
      .filter((m: Record<string, unknown>) => {
        const type = (m.type as string) || '';
        return type === 'text' || !type;
      })
      .map((m: Record<string, unknown>) => ({
        id: m.id as string,
        name: (m.id as string),
        context_length: (m.spec as Record<string, unknown>)?.['context_length'] as number | undefined,
      }))
      .sort((a: ModelOption, b: ModelOption) => a.id.localeCompare(b.id));
    writeCache(cacheId, models);
    return models;
  } catch (e) {
    console.warn('[modelFetcher] Venice fetch failed:', e);
    return [];
  }
}

// ─── LMStudio (local) ──────────────────────────────────────────────────────
async function fetchLMStudioModels(baseUrl: string, port: string): Promise<ModelOption[]> {
  const url = `${baseUrl || 'http://localhost'}:${port || '1234'}/v1/models`;
  const cacheId = `lmstudio_${url}`;
  const cached = readCache(cacheId);
  if (cached) return cached;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const models: ModelOption[] = (json.data || []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      name: (m.id as string),
    }));
    writeCache(cacheId, models);
    return models;
  } catch (e) {
    console.warn('[modelFetcher] LMStudio fetch failed:', e);
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────────────
export async function fetchModelsForProvider(
  providerType: string,
  apiKey?: string,
  baseUrl?: string,
  port?: string,
): Promise<ModelOption[]> {
  switch (providerType) {
    case 'openrouter':
      return fetchOpenRouterModels();
    case 'openai':
      return apiKey ? fetchOpenAIModels(apiKey) : [];
    case 'anthropic':
      return apiKey ? fetchAnthropicModels(apiKey) : [];
    case 'gemini':
      return apiKey ? fetchGeminiModels(apiKey) : [];
    case 'venice':
      return apiKey ? fetchVeniceModels(apiKey) : [];
    case 'lmstudio_local':
      return fetchLMStudioModels(baseUrl || 'http://localhost', port || '1234');
    case 'lmstudio_network':
      return baseUrl ? fetchLMStudioModels(baseUrl, port || '1234') : [];
    default:
      return [];
  }
}

export function clearModelCache(providerType?: string) {
  if (providerType) {
    // Clear all keys starting with orchestra_models_<providerType>
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(`orchestra_models_${providerType}`)) {
        sessionStorage.removeItem(key);
      }
    }
  } else {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('orchestra_models_')) sessionStorage.removeItem(key);
    }
  }
}
