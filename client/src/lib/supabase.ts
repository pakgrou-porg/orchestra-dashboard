import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://domrhrldlufshogewfbp.supabase.co';
// Using the publishable key (safe for frontend) — RLS policies control access
const SUPABASE_ANON_KEY = 'sb_publishable_1SFDQxtGTKtCPRrLW_prdA_zgTIibZj';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Dataset = {
  id: string;
  name: string;
  version: string;
  task_type: string;
  metric_type: string;
  description: string;
  status: 'active' | 'draft' | 'retired';
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
