/*
 * DESIGN: Cyberpunk Terminal / Sci-Fi Operations Dashboard
 * llmProvider.ts — shared utility for building correct LLM API endpoints
 * and making chat completion requests for any configured provider type.
 *
 * Root cause of 404 bug:
 *   - OpenRouter stores base_url = "https://openrouter.ai/api/v1"
 *   - Code was appending "/v1/chat/completions" → double /v1
 *   - Port field (1234 default) was being appended to cloud URLs
 *
 * Fix: buildChatEndpoint() normalises the base_url by stripping any
 * trailing /v1 or /v1/ before appending /v1/chat/completions.
 * Port is ONLY appended for local/network provider types.
 * ============================================================= */

import type { LlmProvider } from './supabase';
import { getProviderKey } from './providerSecrets';

/** Provider types that run locally and need port injection */
const LOCAL_PROVIDER_TYPES = new Set(['lmstudio_local', 'lmstudio_network', 'custom']);

/**
 * Build the correct chat completions endpoint URL for any provider type.
 * Handles:
 *   - OpenRouter / Venice / OpenAI / Anthropic / Gemini: use base_url as-is,
 *     strip trailing /v1 if present, then append /v1/chat/completions
 *   - LMStudio local: http://localhost:<port>/v1/chat/completions
 *   - LMStudio network: http://<base_url>:<port>/v1/chat/completions
 *   - Custom: honour base_url + optional port
 */
export function buildChatEndpoint(provider: LlmProvider): string {
  let base = (provider.base_url || '').trim().replace(/\/$/, '');

  // Inject port ONLY for local/network providers
  if (LOCAL_PROVIDER_TYPES.has(provider.provider_type) && provider.port) {
    // Strip any existing port from the base URL before adding the configured one
    base = base.replace(/:\d+$/, '');
    base = `${base}:${provider.port}`;
  }

  // Default base URLs for cloud providers when not set
  if (!base) {
    const defaults: Record<string, string> = {
      openrouter:       'https://openrouter.ai/api',
      venice:           'https://api.venice.ai/api',
      anthropic:        'https://api.anthropic.com',
      openai:           'https://api.openai.com',
      gemini:           'https://generativelanguage.googleapis.com/v1beta/openai',
      lmstudio_local:   'http://localhost:1234',
      lmstudio_network: 'http://localhost:1234',
      custom:           'http://localhost:1234',
    };
    base = defaults[provider.provider_type] || 'http://localhost:1234';
  }

  // Strip trailing /v1 or /v1/ so we never get double /v1
  base = base.replace(/\/v1\/?$/, '');

  return `${base}/v1/chat/completions`;
}

/**
 * Resolve the raw API key for a provider.
 * Precedence: browser-local secret store (preferred — never leaves the client),
 * then any legacy plaintext value still present on the DB row (deprecated).
 */
export function resolveProviderKey(provider: LlmProvider): string | null {
  return (
    getProviderKey(provider.id) ||
    provider.api_key ||
    provider.api_key_encrypted ||
    null
  );
}

/** Build request headers for the provider */
export function buildHeaders(provider: LlmProvider): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Resolve the key from the browser-local secret store first; fall back to any
  // legacy DB value for backward compatibility. The api_key_hint is masked and
  // intentionally never used for auth.
  const key = resolveProviderKey(provider);
  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  // Anthropic uses a different auth header
  if (provider.provider_type === 'anthropic' && key) {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2024-06-01';
    delete headers['Authorization'];
  }
  // OpenRouter requires HTTP-Referer and X-Title for ranking
  if (provider.provider_type === 'openrouter') {
    headers['HTTP-Referer'] = 'https://orchestra.framework';
    headers['X-Title'] = 'Orchestra Framework';
  }
  return headers;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

/**
 * Make a chat completion request using the configured provider.
 * Returns the assistant message content string.
 * Throws on HTTP errors with a descriptive message.
 */
export async function chatCompletion(
  provider: LlmProvider,
  options: ChatCompletionOptions,
  signal?: AbortSignal,
): Promise<string> {
  const endpoint = buildChatEndpoint(provider);
  const headers = buildHeaders(provider);

  const body: Record<string, unknown> = {
    model:       provider.model_id,
    messages:    options.messages,
    max_tokens:  options.maxTokens  ?? provider.max_tokens  ?? 1024,
    temperature: options.temperature ?? provider.temperature ?? 0.3,
  };

  // Request JSON output mode where supported
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(endpoint, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text();
    // Truncate HTML error pages to avoid flooding the UI
    const preview = txt.startsWith('<!') ? `HTTP ${res.status} — server returned HTML (check endpoint URL)` : txt.slice(0, 300);
    throw new Error(`AI API error ${res.status}: ${preview}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI API returned empty response');
  return content as string;
}

/**
 * Parse a JSON string that may be wrapped in markdown code fences.
 * Throws if the string is not valid JSON after stripping fences.
 */
export function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/,           '')
    .trim();
  return JSON.parse(cleaned) as T;
}
