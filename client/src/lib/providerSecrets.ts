/*
 * providerSecrets.ts — browser-local secret store for LLM provider API keys.
 *
 * SECURITY MODEL
 * --------------
 * The Orchestra Dashboard is a pure client-side app that talks to Supabase with
 * the public (anon/publishable) key. Any value written to a Supabase table is
 * therefore readable by anyone who can read that table under RLS. Storing raw
 * LLM provider API keys in the shared `llm_providers` table would expose those
 * secrets to every visitor.
 *
 * To avoid that, raw provider keys are kept ONLY in this browser-local store
 * (localStorage, scoped to the current origin + browser profile). They are never
 * sent to Supabase. The shared `llm_providers` row stores only a non-sensitive
 * `api_key_hint` (e.g. "sk-or-12...ab9c") so the UI can show which key is set.
 *
 * This is a defense-in-depth improvement, not a substitute for a real backend.
 * localStorage is still readable by any script running on this origin (e.g. via
 * XSS), so the recommended long-term design is a server-side LLM proxy that
 * holds keys in a backend secret manager (see SECURITY.md). Until then, this
 * keeps provider secrets out of the multi-tenant database entirely.
 */

const STORAGE_PREFIX = 'orchestra.providerKey.';

function storageKey(providerId: string): string {
  return `${STORAGE_PREFIX}${providerId}`;
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/** Store (or clear) the raw API key for a provider in browser-local storage. */
export function setProviderKey(providerId: string, key: string | null | undefined): void {
  if (!hasStorage() || !providerId) return;
  try {
    if (key && key.trim()) {
      window.localStorage.setItem(storageKey(providerId), key.trim());
    } else {
      window.localStorage.removeItem(storageKey(providerId));
    }
  } catch {
    /* storage may be unavailable (private mode / quota) — fail silently */
  }
}

/** Retrieve the raw API key for a provider from browser-local storage. */
export function getProviderKey(providerId: string): string | null {
  if (!hasStorage() || !providerId) return null;
  try {
    return window.localStorage.getItem(storageKey(providerId));
  } catch {
    return null;
  }
}

/** Remove a provider's stored key (e.g. when the provider is deleted). */
export function clearProviderKey(providerId: string): void {
  setProviderKey(providerId, null);
}

/** True if a raw key is stored locally for this provider. */
export function hasProviderKey(providerId: string): boolean {
  return !!getProviderKey(providerId);
}

/**
 * Build a short, non-sensitive hint from a raw key, safe to persist in the DB.
 * Example: "sk-or-v1...9c3a". Returns '' for empty input.
 */
export function buildKeyHint(rawKey: string | null | undefined): string {
  const k = (rawKey || '').trim();
  if (!k) return '';
  if (k.length <= 12) return `${k.slice(0, 2)}...`;
  return `${k.slice(0, 8)}...${k.slice(-4)}`;
}
