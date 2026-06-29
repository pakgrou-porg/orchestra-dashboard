import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://domrhrldlufshogewfbp.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Dataset = {
  id: string;
  name: string;
  version: string;
  task_type: string;
  metric_type: string;
  description: string;
  status: 'active' | 'draft' | 'retired' | 'generating';
  train_path: string;
  eval_path: string;
  num_train: number;
  num_eval: number;
  format: string;
  generation_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type HardwareProfile = {
  id: string;
  name: string;
  machine_name: string;
  gpu_model: string;
  vram_gb: number;
  cpu_model: string;
  ram_gb: number;
  os: string;
  docker: boolean;
  lmstudio: boolean;
  created_at: string;
};

export type LlmProvider = {
  id: string;
  name: string;
  provider_type: 'lmstudio_local' | 'lmstudio_network' | 'openrouter' | 'venice' | 'anthropic' | 'openai' | 'gemini' | 'custom';
  display_name: string;
  base_url: string | null;
  model_id: string;
  api_key_hint: string | null;  // masked hint only (safe to store in DB)
  // SECURITY: raw provider keys are NO LONGER written to the DB. They live in the
  // browser-local secret store (see lib/providerSecrets.ts). These fields remain
  // only to read legacy rows written before the secure-by-default change.
  api_key: string | null;  // @deprecated legacy plaintext key (do not write)
  api_key_encrypted: string | null;  // @deprecated legacy encrypted field
  quick_register_source: string | null;
  port: number | null;
  context_length: number;
  max_tokens: number;
  temperature: number;
  is_default: boolean;
  is_active: boolean;
  capabilities: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ModelCatalogEntry = {
  id: string;
  provider_type: string;
  model_id: string;
  display_name: string;
  context_length: number;
  speed_tier: 'fast' | 'medium' | 'slow';
  is_featured: boolean;
  notes: string | null;
  created_at: string;
};

export type DatasetSample = {
  id: string;
  dataset_id: string;
  split: 'train' | 'eval';
  index: number;
  system_prompt: string;
  user_prompt: string;
  assistant_response: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ConductorProfile = {
  id: string;
  name: string;
  model_id: string;
  provider: string;
  max_tokens: number;
  temperature: number;
  created_at: string;
};
