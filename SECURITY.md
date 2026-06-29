# Orchestra Dashboard — Security Model

This document describes the security model of the Orchestra Dashboard and the
secure-by-default conventions that code changes must follow. It complements the
SDK-side database hardening (see `orchestra_sdk/db_migrations.py`, blocks
`010`–`013`).

## Architecture in one paragraph

The dashboard is a **pure client-side React app**. It talks to Supabase directly
using the **public anon/publishable key**, which ships in the browser bundle and
must be treated as world-readable. There is **no backend application server** in
this repository (`server/index.ts` only serves static files). Consequently,
*every* security guarantee for data access must be enforced by **Postgres RLS
policies in Supabase**, and **no secret may be placed in any table that the anon
key can read**.

## Key handling (LLM providers)

### What changed

Previously, raw LLM provider API keys were written to the `llm_providers.api_key`
column and read back into the browser to authenticate LLM calls. Because the
table is reachable with the public anon key, those secrets were exposed to anyone
who could read the table.

### Current model (secure by default)

- Raw provider API keys are stored **only in the browser-local secret store**
  (`localStorage`, scoped to the origin + browser profile) via
  `client/src/lib/providerSecrets.ts`. They are **never written to Supabase**.
- The shared `llm_providers` row stores only a **masked hint** (`api_key_hint`,
  e.g. `sk-or-v1...9c3a`) so the UI can indicate which key is configured.
- At call time, `lib/llmProvider.ts` → `resolveProviderKey()` reads the key from
  the local store, falling back to any legacy plaintext DB value only for
  backward compatibility.
- On the database side, migration block `013_secure_rls_llm_providers`:
  - enables RLS on `llm_providers`,
  - restricts all access to the `authenticated` role,
  - **revokes the `api_key` column** from the `anon` role as defense in depth.

### Consequences for users

- Keys must be re-entered per browser/device (they are not synced).
- Clearing browser storage removes stored keys (hints remain in the DB).

### Known limitation / recommended upgrade

`localStorage` is still readable by any script executing on this origin, so this
model mitigates the *multi-tenant database exposure* but does not defend against
XSS. The recommended long-term design is a **server-side LLM proxy**: a small
backend that holds provider keys in a secret manager (e.g. Supabase Vault or an
env-backed service) and exposes only an authenticated `/chat` endpoint, so keys
never reach the browser at all. Adopting it requires adding a backend tier and is
intentionally out of scope for the current client-only deployment.

## Database access (RLS)

- All tables are accessed with the anon key and are therefore subject to RLS.
- The hardened model (SDK migration blocks `010`–`012`) is:
  - **Read**: `anon` and `authenticated` may `SELECT` operational tables
    (`conductor_sessions`, `conductor_experiments`, `conductor_memories`,
    `session_best_runs`, `datasets`, `dataset_samples`, `hardware_profiles`).
  - **Write**: only the `authenticated` role may `INSERT`/`UPDATE`/`DELETE`.
  - The Conductor SDK runs as a trusted backend using the **service-role key**,
    which bypasses RLS; it does not rely on permissive `USING (true)` write
    policies.
- The blanket `FOR ALL USING (true)` policies that previously allowed the public
  anon key to write/delete arbitrary rows have been removed.

## Rules for contributors

1. **Never** write a secret (API key, token, password) to any Supabase table the
   anon key can read. Use the browser-local secret store or a backend.
2. **Never** widen an RLS policy to `USING (true)` for writes. Scope writes to
   `authenticated` (and, once Supabase Auth is wired in, to `auth.uid()`
   ownership).
3. The **service-role key must never** appear in client code, the bundle, or any
   `VITE_*` env var. It belongs only to the backend SDK.
4. Treat the anon/publishable key as public; security comes from RLS, not from
   hiding the key.
5. Run `pnpm exec tsc --noEmit` before saving a checkpoint.
