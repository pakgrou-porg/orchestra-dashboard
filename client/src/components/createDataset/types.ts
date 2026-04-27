import { FileCode2, Shield, Brain, BarChart3, FolderOpen, Sparkles } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
export type TaskType =
  | 'sql_correction'
  | 'ttp_detection'
  | 'text_classification'
  | 'code_generation'
  | 'qa_extraction'
  | 'custom';

export type MetricType =
  | 'sql_execution_accuracy'
  | 'ttp_f1'
  | 'classification_accuracy'
  | 'bleu'
  | 'rouge_l'
  | 'exact_match'
  | 'llm_judge'
  | 'custom';

export type FormatType = 'jsonl' | 'json' | 'csv' | 'parquet';

export interface CategoryEntry { label: string; count: number; color: string }

export interface FormData {
  // Step 1 — Identity
  name: string;
  version: string;
  description: string;
  status: 'draft' | 'active';
  // Step 2 — Task Config
  task_type: TaskType;
  metric_type: MetricType;
  custom_task_type: string;
  custom_metric_type: string;
  model_hint: string;
  system_prompt_template: string;
  // Step 3 — Generation
  num_train: number;
  num_eval: number;
  categories: CategoryEntry[];
  generation_notes: string;
  // Step 4 — Paths
  train_path: string;
  eval_path: string;
  format: FormatType;
}

// ── Constants ──────────────────────────────────────────────────
export const DEFAULT_COLORS = [
  '#06B6D4', '#7C3AED', '#F59E0B', '#10B981',
  '#F43F5E', '#94A3B8', '#64748B', '#3B82F6',
  '#EC4899', '#8B5CF6',
];

export const TASK_OPTIONS: { value: TaskType; label: string; icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>; color: string; desc: string }[] = [
  { value: 'sql_correction', label: 'SQL Correction', icon: FileCode2, color: '#06B6D4', desc: 'Identify and fix errors in SQL queries' },
  { value: 'ttp_detection', label: 'TTP Detection', icon: Shield, color: '#7C3AED', desc: 'Classify MITRE ATT&CK TTPs / OWASP vulnerabilities' },
  { value: 'text_classification', label: 'Text Classification', icon: BarChart3, color: '#F59E0B', desc: 'Multi-class or binary label classification' },
  { value: 'code_generation', label: 'Code Generation', icon: FileCode2, color: '#10B981', desc: 'Generate code from natural language descriptions' },
  { value: 'qa_extraction', label: 'QA / Extraction', icon: Brain, color: '#F43F5E', desc: 'Question answering or structured extraction' },
  { value: 'custom', label: 'Custom', icon: Sparkles, color: '#94A3B8', desc: 'Define your own task type and metric' },
];

export const METRIC_OPTIONS: { value: MetricType; label: string; desc: string; tasks: TaskType[] }[] = [
  { value: 'sql_execution_accuracy', label: 'SQL Execution Accuracy', desc: 'Run query against DB and check result correctness', tasks: ['sql_correction'] },
  { value: 'ttp_f1', label: 'TTP F1 Score', desc: 'Macro-F1 across all TTP / OWASP classes', tasks: ['ttp_detection'] },
  { value: 'classification_accuracy', label: 'Classification Accuracy', desc: 'Top-1 accuracy for label prediction', tasks: ['text_classification'] },
  { value: 'bleu', label: 'BLEU', desc: 'N-gram overlap for generation tasks', tasks: ['code_generation', 'qa_extraction', 'custom'] },
  { value: 'rouge_l', label: 'ROUGE-L', desc: 'Longest common subsequence recall', tasks: ['qa_extraction', 'custom'] },
  { value: 'exact_match', label: 'Exact Match', desc: 'Strict string equality after normalization', tasks: ['sql_correction', 'code_generation', 'qa_extraction', 'custom'] },
  { value: 'llm_judge', label: 'LLM-as-Judge', desc: 'Score responses using a judge model (0–10)', tasks: ['code_generation', 'qa_extraction', 'custom'] },
  { value: 'custom', label: 'Custom Metric', desc: 'Define your own evaluation function', tasks: ['custom'] },
];

export const DEFAULT_CATEGORIES: Record<TaskType, CategoryEntry[]> = {
  sql_correction: [
    { label: 'Syntax Error', count: 30, color: '#06B6D4' },
    { label: 'Logic Error', count: 25, color: '#7C3AED' },
    { label: 'Type Mismatch', count: 20, color: '#F59E0B' },
    { label: 'Aggregation', count: 15, color: '#10B981' },
    { label: 'Join Error', count: 10, color: '#F43F5E' },
  ],
  ttp_detection: [
    { label: 'Initial Access', count: 20, color: '#06B6D4' },
    { label: 'Execution', count: 20, color: '#7C3AED' },
    { label: 'Persistence', count: 20, color: '#F59E0B' },
    { label: 'Privilege Escalation', count: 20, color: '#10B981' },
    { label: 'Defense Evasion', count: 20, color: '#F43F5E' },
  ],
  text_classification: [
    { label: 'Class A', count: 50, color: '#06B6D4' },
    { label: 'Class B', count: 50, color: '#7C3AED' },
  ],
  code_generation: [
    { label: 'Functions', count: 40, color: '#06B6D4' },
    { label: 'Classes', count: 30, color: '#7C3AED' },
    { label: 'Algorithms', count: 30, color: '#F59E0B' },
  ],
  qa_extraction: [
    { label: 'Factual', count: 50, color: '#06B6D4' },
    { label: 'Inferential', count: 30, color: '#7C3AED' },
    { label: 'Abstractive', count: 20, color: '#F59E0B' },
  ],
  custom: [],
};

export const STEPS = [
  { id: 1, label: 'Identity', icon: Brain },
  { id: 2, label: 'Task', icon: BarChart3 },
  { id: 3, label: 'Generation', icon: Sparkles },
  { id: 4, label: 'Paths', icon: FolderOpen },
  { id: 5, label: 'AI Refine', icon: Sparkles },
  { id: 6, label: 'Review', icon: () => null }, // Check icon used inline in main component
];

export const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#E2E8F0',
};

// ── Helpers ────────────────────────────────────────────────────
export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function deriveDefaultPaths(name: string, version: string) {
  const slug = slugify(name);
  const ver = version.replace(/\./g, '_');
  return {
    train: `./datasets/${slug}_${ver}/train.jsonl`,
    eval: `./datasets/${slug}_${ver}/eval.jsonl`,
  };
}

export function defaultFormData(): FormData {
  return {
    name: '',
    version: 'v1',
    description: '',
    status: 'draft',
    task_type: 'sql_correction',
    metric_type: 'sql_execution_accuracy',
    custom_task_type: '',
    custom_metric_type: '',
    model_hint: '',
    system_prompt_template: '',
    num_train: 170,
    num_eval: 30,
    categories: DEFAULT_CATEGORIES['sql_correction'],
    generation_notes: '',
    train_path: './datasets/new_dataset_v1/train.jsonl',
    eval_path: './datasets/new_dataset_v1/eval.jsonl',
    format: 'jsonl',
  };
}

export function stepValid(form: FormData, s: number): boolean {
  switch (s) {
    case 1: return form.name.trim().length >= 2;
    case 2: return form.task_type !== 'custom' || form.custom_task_type.trim().length > 0;
    case 3: return form.num_train >= 10 && form.num_eval >= 5 && form.categories.length > 0;
    case 4: return form.train_path.trim().length > 0 && form.eval_path.trim().length > 0;
    case 5: return true; // AI Refine is always skippable
    default: return true;
  }
}
