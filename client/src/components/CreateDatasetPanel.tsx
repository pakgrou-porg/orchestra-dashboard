/* =============================================================
   CreateDatasetPanel — Multi-step wizard to define & register
   a new dataset in the Composer / Supabase registry.
   Design: Cyberpunk Terminal — glass cards, cyan/violet accents
   Steps:
     1. Identity    — name, version, description, status
     2. Task Config — task type, metric, model hint
     3. Generation  — sample counts, split ratio, categories
     4. Paths       — train/eval file paths, format
     5. Review      — summary before saving to Supabase
   ============================================================= */
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  X, ChevronRight, ChevronLeft, Check, Loader2,
  FileCode2, Shield, Brain, BarChart3, FolderOpen,
  Plus, Trash2, AlertCircle, CheckCircle2, Sparkles
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
type TaskType =
  | 'sql_correction'
  | 'ttp_detection'
  | 'text_classification'
  | 'code_generation'
  | 'qa_extraction'
  | 'custom';

type MetricType =
  | 'sql_execution_accuracy'
  | 'ttp_f1'
  | 'classification_accuracy'
  | 'bleu'
  | 'rouge_l'
  | 'exact_match'
  | 'llm_judge'
  | 'custom';

type FormatType = 'jsonl' | 'json' | 'csv' | 'parquet';

interface CategoryEntry { label: string; count: number; color: string }

interface FormData {
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

const DEFAULT_COLORS = [
  '#06B6D4', '#7C3AED', '#F59E0B', '#10B981',
  '#F43F5E', '#94A3B8', '#64748B', '#3B82F6',
  '#EC4899', '#8B5CF6',
];

const TASK_OPTIONS: { value: TaskType; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { value: 'sql_correction', label: 'SQL Correction', icon: FileCode2, color: '#06B6D4', desc: 'Identify and fix errors in SQL queries' },
  { value: 'ttp_detection', label: 'TTP Detection', icon: Shield, color: '#7C3AED', desc: 'Classify MITRE ATT&CK TTPs / OWASP vulnerabilities' },
  { value: 'text_classification', label: 'Text Classification', icon: BarChart3, color: '#F59E0B', desc: 'Multi-class or binary label classification' },
  { value: 'code_generation', label: 'Code Generation', icon: FileCode2, color: '#10B981', desc: 'Generate code from natural language descriptions' },
  { value: 'qa_extraction', label: 'QA / Extraction', icon: Brain, color: '#F43F5E', desc: 'Question answering or structured extraction' },
  { value: 'custom', label: 'Custom', icon: Sparkles, color: '#94A3B8', desc: 'Define your own task type and metric' },
];

const METRIC_OPTIONS: { value: MetricType; label: string; desc: string; tasks: TaskType[] }[] = [
  { value: 'sql_execution_accuracy', label: 'SQL Execution Accuracy', desc: 'Run query against DB and check result correctness', tasks: ['sql_correction'] },
  { value: 'ttp_f1', label: 'TTP F1 Score', desc: 'Macro-F1 across all TTP / OWASP classes', tasks: ['ttp_detection'] },
  { value: 'classification_accuracy', label: 'Classification Accuracy', desc: 'Top-1 accuracy for label prediction', tasks: ['text_classification'] },
  { value: 'bleu', label: 'BLEU', desc: 'N-gram overlap for generation tasks', tasks: ['code_generation', 'qa_extraction', 'custom'] },
  { value: 'rouge_l', label: 'ROUGE-L', desc: 'Longest common subsequence recall', tasks: ['qa_extraction', 'custom'] },
  { value: 'exact_match', label: 'Exact Match', desc: 'Strict string equality after normalization', tasks: ['sql_correction', 'code_generation', 'qa_extraction', 'custom'] },
  { value: 'llm_judge', label: 'LLM-as-Judge', desc: 'Score responses using a judge model (0–10)', tasks: ['code_generation', 'qa_extraction', 'custom'] },
  { value: 'custom', label: 'Custom Metric', desc: 'Define your own evaluation function', tasks: ['custom'] },
];

const DEFAULT_CATEGORIES: Record<TaskType, CategoryEntry[]> = {
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

const STEPS = [
  { id: 1, label: 'Identity', icon: Brain },
  { id: 2, label: 'Task', icon: BarChart3 },
  { id: 3, label: 'Generation', icon: Sparkles },
  { id: 4, label: 'Paths', icon: FolderOpen },
  { id: 5, label: 'Review', icon: Check },
];

// ── Helpers ────────────────────────────────────────────────────
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function deriveDefaultPaths(name: string, version: string) {
  const slug = slugify(name);
  const ver = version.replace(/\./g, '_');
  return {
    train: `./datasets/${slug}_${ver}/train.jsonl`,
    eval: `./datasets/${slug}_${ver}/eval.jsonl`,
  };
}

// ── Main Component ─────────────────────────────────────────────
type Props = { onClose: () => void; onCreated: () => void };

export default function CreateDatasetPanel({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<FormData>({
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
  });

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      // Auto-derive paths when name/version change
      if (key === 'name' || key === 'version') {
        const paths = deriveDefaultPaths(
          key === 'name' ? String(value) : prev.name,
          key === 'version' ? String(value) : prev.version
        );
        next.train_path = paths.train;
        next.eval_path = paths.eval;
      }
      // Auto-populate categories when task type changes
      if (key === 'task_type') {
        next.categories = DEFAULT_CATEGORIES[value as TaskType] || [];
        // Auto-select first compatible metric
        const compatMetrics = METRIC_OPTIONS.filter(m => m.tasks.includes(value as TaskType));
        if (compatMetrics.length > 0) next.metric_type = compatMetrics[0].value;
      }
      return next;
    });
  }, []);

  // ── Validation ─────────────────────────────────────────────
  const stepValid = (s: number): boolean => {
    switch (s) {
      case 1: return form.name.trim().length >= 2;
      case 2: return form.task_type !== 'custom' || form.custom_task_type.trim().length > 0;
      case 3: return form.num_train >= 10 && form.num_eval >= 5 && form.categories.length > 0;
      case 4: return form.train_path.trim().length > 0 && form.eval_path.trim().length > 0;
      default: return true;
    }
  };

  // ── Save to Supabase ────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: slugify(form.name) + '_' + form.version.replace(/\./g, ''),
        version: form.version,
        description: form.description || null,
        status: form.status,
        task_type: form.task_type === 'custom' ? slugify(form.custom_task_type) : form.task_type,
        metric_type: form.metric_type === 'custom' ? slugify(form.custom_metric_type) : form.metric_type,
        num_train: form.num_train,
        num_eval: form.num_eval,
        train_path: form.train_path,
        eval_path: form.eval_path,
        format: form.format,
        generation_config: {
          model_hint: form.model_hint || null,
          system_prompt_template: form.system_prompt_template || null,
          categories: form.categories,
          generation_notes: form.generation_notes || null,
        },
      };

      const { error } = await supabase.from('datasets').insert([payload]);
      if (error) throw error;

      setSaved(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error saving dataset');
    } finally {
      setSaving(false);
    }
  };

  const accentColor = TASK_OPTIONS.find(t => t.value === form.task_type)?.color || '#06B6D4';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full max-w-2xl flex flex-col overflow-hidden"
        style={{
          background: '#0A0F1A',
          borderLeft: `1px solid ${accentColor}33`,
          boxShadow: `-24px 0 80px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${accentColor}22`, background: `${accentColor}07` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}
            >
              <Plus size={15} style={{ color: accentColor }} />
            </div>
            <div>
              <div
                className="font-semibold text-slate-100 text-sm"
                style={{ fontFamily: 'Orbitron, monospace', letterSpacing: '0.08em', fontSize: '0.7rem' }}
              >
                NEW DATASET
              </div>
              <div className="text-xs text-slate-500">Define dataset requirements for Composer</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Step indicator */}
        <div
          className="px-6 py-3 flex items-center gap-0 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            const StepIcon = s.icon;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => done && setStep(s.id)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded transition-all"
                  style={{ cursor: done ? 'pointer' : 'default' }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: done ? '#10B981' : active ? accentColor : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${done ? '#10B981' : active ? accentColor : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {done
                      ? <Check size={10} className="text-white" />
                      : <StepIcon size={9} style={{ color: active ? '#070B14' : '#475569' }} />
                    }
                  </div>
                  <span
                    className="text-xs hidden sm:block"
                    style={{
                      color: done ? '#10B981' : active ? accentColor : '#475569',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.65rem',
                    }}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="w-6 h-px mx-1"
                    style={{ background: done ? '#10B98144' : 'rgba(255,255,255,0.07)' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && <Step1Identity form={form} set={set} accentColor={accentColor} />}
          {step === 2 && <Step2Task form={form} set={set} accentColor={accentColor} />}
          {step === 3 && <Step3Generation form={form} set={set} accentColor={accentColor} />}
          {step === 4 && <Step4Paths form={form} set={set} accentColor={accentColor} />}
          {step === 5 && (
            <Step5Review
              form={form}
              accentColor={accentColor}
              saving={saving}
              saved={saved}
              saveError={saveError}
            />
          )}
        </div>

        {/* Footer nav */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm transition-all disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
          >
            <ChevronLeft size={14} /> Back
          </button>

          <div className="flex items-center gap-2">
            {saveError && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle size={12} /> {saveError}
              </div>
            )}
            {step < 5 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!stepValid(step)}
                className="flex items-center gap-2 px-5 py-2 rounded text-sm font-medium transition-all disabled:opacity-30"
                style={{ background: accentColor, color: '#070B14' }}
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex items-center gap-2 px-5 py-2 rounded text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: saved ? '#10B981' : accentColor, color: '#070B14' }}
              >
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : saved
                  ? <><CheckCircle2 size={14} /> Saved!</>
                  : <><Check size={14} /> Create Dataset</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Identity ───────────────────────────────────────────
function Step1Identity({ form, set, accentColor }: { form: FormData; set: (k: keyof FormData, v: FormData[keyof FormData]) => void; accentColor: string }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Dataset Identity" desc="Define the name, version, and purpose of this dataset." accentColor={accentColor} />

      <Field label="Dataset Name *" hint="Use a descriptive name — will be slugified for storage">
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. SQL Correction v2, MITRE TTP Advanced"
          className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600"
          style={inputStyle}
        />
        {form.name && (
          <div className="mt-1 text-xs text-slate-500 metric-value">
            Storage key: <span style={{ color: accentColor }}>{slugify(form.name)}_{form.version.replace(/\./g, '')}</span>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Version *">
          <input
            value={form.version}
            onChange={e => set('version', e.target.value)}
            placeholder="v1"
            className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600"
            style={inputStyle}
          />
        </Field>
        <Field label="Initial Status">
          <select
            value={form.status}
            onChange={e => set('status', e.target.value as 'draft' | 'active')}
            className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200"
            style={inputStyle}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </Field>
      </div>

      <Field label="Description" hint="Optional — explain the purpose and scope of this dataset">
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Describe what this dataset is for, what model it targets, and any special requirements..."
          rows={4}
          className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600 resize-none"
          style={inputStyle}
        />
      </Field>
    </div>
  );
}

// ── Step 2: Task Config ────────────────────────────────────────
function Step2Task({ form, set, accentColor }: { form: FormData; set: (k: keyof FormData, v: FormData[keyof FormData]) => void; accentColor: string }) {
  const compatMetrics = METRIC_OPTIONS.filter(m =>
    m.tasks.includes(form.task_type) || form.task_type === 'custom'
  );

  return (
    <div className="space-y-5">
      <StepHeader title="Task Configuration" desc="Choose the task type and how model outputs will be evaluated." accentColor={accentColor} />

      <Field label="Task Type *">
        <div className="grid grid-cols-2 gap-2 mt-1">
          {TASK_OPTIONS.map(t => {
            const TIcon = t.icon;
            const active = form.task_type === t.value;
            return (
              <button
                key={t.value}
                onClick={() => set('task_type', t.value)}
                className="flex items-start gap-2.5 p-3 rounded text-left transition-all"
                style={{
                  background: active ? `${t.color}12` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${active ? t.color + '44' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <TIcon size={14} style={{ color: t.color, marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div className="text-xs font-medium text-slate-200">{t.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5" style={{ fontSize: '0.65rem' }}>{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      {form.task_type === 'custom' && (
        <Field label="Custom Task Type Name *">
          <input
            value={form.custom_task_type}
            onChange={e => set('custom_task_type', e.target.value)}
            placeholder="e.g. intent_classification"
            className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600"
            style={inputStyle}
          />
        </Field>
      )}

      <Field label="Evaluation Metric *">
        <div className="space-y-1.5 mt-1">
          {compatMetrics.map(m => {
            const active = form.metric_type === m.value;
            return (
              <button
                key={m.value}
                onClick={() => set('metric_type', m.value)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded text-left transition-all"
                style={{
                  background: active ? `${accentColor}10` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${active ? accentColor + '44' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div>
                  <div className="text-xs font-medium text-slate-200">{m.label}</div>
                  <div className="text-xs text-slate-500" style={{ fontSize: '0.65rem' }}>{m.desc}</div>
                </div>
                {active && <Check size={13} style={{ color: accentColor, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </Field>

      {form.metric_type === 'custom' && (
        <Field label="Custom Metric Name *">
          <input
            value={form.custom_metric_type}
            onChange={e => set('custom_metric_type', e.target.value)}
            placeholder="e.g. my_custom_score"
            className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600"
            style={inputStyle}
          />
        </Field>
      )}

      <Field label="Target Model Hint" hint="Optional — helps the generator tailor samples for a specific model">
        <input
          value={form.model_hint}
          onChange={e => set('model_hint', e.target.value)}
          placeholder="e.g. nemotron-3-nano, qwen2.5-7b, llama-3.1-8b"
          className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600"
          style={inputStyle}
        />
      </Field>

      <Field label="System Prompt Template" hint="Optional — override the default system prompt used during generation">
        <textarea
          value={form.system_prompt_template}
          onChange={e => set('system_prompt_template', e.target.value)}
          placeholder="You are an expert SQL developer. Given a broken SQL query, identify the error and return the corrected version..."
          rows={3}
          className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600 resize-none"
          style={inputStyle}
        />
      </Field>
    </div>
  );
}

// ── Step 3: Generation ─────────────────────────────────────────
function Step3Generation({ form, set, accentColor }: { form: FormData; set: (k: keyof FormData, v: FormData[keyof FormData]) => void; accentColor: string }) {
  const totalCat = form.categories.reduce((s, c) => s + c.count, 0);
  const totalSamples = form.num_train + form.num_eval;

  const updateCategory = (i: number, field: keyof CategoryEntry, value: string | number) => {
    const updated = form.categories.map((c, idx) =>
      idx === i ? { ...c, [field]: value } : c
    );
    set('categories', updated);
  };

  const addCategory = () => {
    const colorIdx = form.categories.length % DEFAULT_COLORS.length;
    set('categories', [...form.categories, { label: '', count: 10, color: DEFAULT_COLORS[colorIdx] }]);
  };

  const removeCategory = (i: number) => {
    set('categories', form.categories.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-5">
      <StepHeader title="Generation Parameters" desc="Set sample counts, train/eval split, and category distribution." accentColor={accentColor} />

      <div className="grid grid-cols-3 gap-4">
        <Field label="Train Samples *">
          <input
            type="number"
            min={10}
            value={form.num_train}
            onChange={e => set('num_train', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200"
            style={inputStyle}
          />
        </Field>
        <Field label="Eval Samples *">
          <input
            type="number"
            min={5}
            value={form.num_eval}
            onChange={e => set('num_eval', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200"
            style={inputStyle}
          />
        </Field>
        <Field label="Total">
          <div
            className="px-3 py-2 text-sm rounded metric-value"
            style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}33`, color: accentColor }}
          >
            {totalSamples.toLocaleString()}
          </div>
        </Field>
      </div>

      {/* Split ratio visual */}
      <div>
        <div className="text-xs text-slate-500 mb-2">Split ratio</div>
        <div className="h-2 rounded-full overflow-hidden flex">
          <div
            className="h-full transition-all"
            style={{ width: `${(form.num_train / totalSamples) * 100}%`, background: accentColor }}
          />
          <div className="h-full flex-1" style={{ background: 'rgba(124,58,237,0.4)' }} />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1 metric-value">
          <span style={{ color: accentColor }}>{Math.round((form.num_train / totalSamples) * 100)}% train</span>
          <span style={{ color: '#7C3AED' }}>{Math.round((form.num_eval / totalSamples) * 100)}% eval</span>
        </div>
      </div>

      {/* Categories */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-medium text-slate-300">Category Distribution *</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Total defined: <span className="metric-value" style={{ color: totalCat !== form.num_train ? '#F59E0B' : '#10B981' }}>{totalCat}</span>
              {totalCat !== form.num_train && <span className="ml-1 text-amber-400">(target: {form.num_train} train)</span>}
            </div>
          </div>
          <button
            onClick={addCategory}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all"
            style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}33`, color: accentColor }}
          >
            <Plus size={11} /> Add Category
          </button>
        </div>
        <div className="space-y-2">
          {form.categories.map((cat, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={cat.color}
                onChange={e => updateCategory(i, 'color', e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0 p-0.5"
                style={{ background: 'transparent' }}
              />
              <input
                value={cat.label}
                onChange={e => updateCategory(i, 'label', e.target.value)}
                placeholder="Category name"
                className="flex-1 px-2.5 py-1.5 text-xs rounded outline-none text-slate-200 placeholder-slate-600"
                style={inputStyle}
              />
              <input
                type="number"
                min={1}
                value={cat.count}
                onChange={e => updateCategory(i, 'count', parseInt(e.target.value) || 0)}
                className="w-16 px-2.5 py-1.5 text-xs rounded outline-none text-slate-200 metric-value text-center"
                style={inputStyle}
              />
              <div
                className="h-1.5 w-20 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (cat.count / form.num_train) * 100)}%`, background: cat.color }}
                />
              </div>
              <button
                onClick={() => removeCategory(i)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Field label="Generation Notes" hint="Optional — additional instructions for the Composer generator">
        <textarea
          value={form.generation_notes}
          onChange={e => set('generation_notes', e.target.value)}
          placeholder="e.g. Ensure queries use PostgreSQL syntax. Include CTEs and window functions in at least 20% of samples..."
          rows={3}
          className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600 resize-none"
          style={inputStyle}
        />
      </Field>
    </div>
  );
}

// ── Step 4: Paths ──────────────────────────────────────────────
function Step4Paths({ form, set, accentColor }: { form: FormData; set: (k: keyof FormData, v: FormData[keyof FormData]) => void; accentColor: string }) {
  return (
    <div className="space-y-5">
      <StepHeader title="File Paths & Format" desc="Define where the generated dataset files will be stored." accentColor={accentColor} />

      <Field label="Train File Path *" hint="Relative to the Orchestra project root">
        <input
          value={form.train_path}
          onChange={e => set('train_path', e.target.value)}
          placeholder="./datasets/my_dataset_v1/train.jsonl"
          className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600"
          style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
        />
      </Field>

      <Field label="Eval File Path *">
        <input
          value={form.eval_path}
          onChange={e => set('eval_path', e.target.value)}
          placeholder="./datasets/my_dataset_v1/eval.jsonl"
          className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600"
          style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
        />
      </Field>

      <Field label="File Format">
        <div className="grid grid-cols-4 gap-2 mt-1">
          {(['jsonl', 'json', 'csv', 'parquet'] as FormatType[]).map(f => (
            <button
              key={f}
              onClick={() => set('format', f)}
              className="py-2 rounded text-xs font-medium transition-all metric-value"
              style={{
                background: form.format === f ? `${accentColor}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${form.format === f ? accentColor + '44' : 'rgba(255,255,255,0.07)'}`,
                color: form.format === f ? accentColor : '#64748B',
              }}
            >
              .{f}
            </button>
          ))}
        </div>
      </Field>

      <div
        className="rounded-lg p-4 text-xs space-y-1.5"
        style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}
      >
        <div className="flex items-center gap-2 text-slate-400 font-medium mb-2">
          <FolderOpen size={12} style={{ color: '#06B6D4' }} />
          <span>Expected file structure</span>
        </div>
        <div className="metric-value text-slate-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          <div>orchestra/</div>
          <div className="ml-4">datasets/</div>
          <div className="ml-8" style={{ color: '#06B6D4' }}>{form.train_path.split('/').pop()}</div>
          <div className="ml-8" style={{ color: '#7C3AED' }}>{form.eval_path.split('/').pop()}</div>
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Review ─────────────────────────────────────────────
function Step5Review({ form, accentColor, saving, saved, saveError }: {
  form: FormData; accentColor: string;
  saving: boolean; saved: boolean; saveError: string | null;
}) {
  const taskOpt = TASK_OPTIONS.find(t => t.value === form.task_type);
  const metricOpt = METRIC_OPTIONS.find(m => m.value === form.metric_type);
  const TaskIcon = taskOpt?.icon || Brain;

  return (
    <div className="space-y-5">
      <StepHeader title="Review & Create" desc="Confirm the dataset definition before saving to Supabase." accentColor={accentColor} />

      {saved && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}
        >
          <CheckCircle2 size={18} style={{ color: '#10B981' }} />
          <div>
            <div className="text-sm font-medium text-emerald-400">Dataset registered successfully!</div>
            <div className="text-xs text-slate-500 mt-0.5">Closing panel and refreshing registry…</div>
          </div>
        </div>
      )}

      {saveError && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg"
          style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)' }}
        >
          <AlertCircle size={16} style={{ color: '#F43F5E' }} />
          <div className="text-sm text-red-400">{saveError}</div>
        </div>
      )}

      {/* Summary card */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: `1px solid ${accentColor}22` }}
      >
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ background: `${accentColor}08`, borderBottom: `1px solid ${accentColor}15` }}
        >
          <TaskIcon size={16} style={{ color: accentColor }} />
          <div>
            <div className="font-semibold text-slate-100 text-sm metric-value">
              {slugify(form.name)}_{form.version.replace(/\./g, '')}
            </div>
            <div className="text-xs text-slate-500">{form.description || 'No description'}</div>
          </div>
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded metric-value"
            style={{
              background: form.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
              color: form.status === 'active' ? '#10B981' : '#64748B',
              border: `1px solid ${form.status === 'active' ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.3)'}`,
            }}
          >
            {form.status}
          </span>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
          <ReviewRow label="Task Type" value={taskOpt?.label || form.custom_task_type} color={accentColor} />
          <ReviewRow label="Metric" value={metricOpt?.label || form.custom_metric_type} color={accentColor} />
          <ReviewRow label="Train Samples" value={form.num_train.toLocaleString()} />
          <ReviewRow label="Eval Samples" value={form.num_eval.toLocaleString()} />
          <ReviewRow label="Total Samples" value={(form.num_train + form.num_eval).toLocaleString()} />
          <ReviewRow label="Categories" value={`${form.categories.length} defined`} />
          <ReviewRow label="Format" value={`.${form.format}`} />
          {form.model_hint && <ReviewRow label="Model Hint" value={form.model_hint} />}
        </div>
      </div>

      {/* Category preview */}
      {form.categories.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium">Category distribution</div>
          <div className="space-y-1.5">
            {form.categories.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                <div className="text-xs text-slate-400 w-32 truncate">{c.label || '(unnamed)'}</div>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (c.count / form.num_train) * 100)}%`, background: c.color }}
                  />
                </div>
                <div className="metric-value text-xs text-slate-500 w-8 text-right">{c.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Path summary */}
      <div
        className="rounded p-3 text-xs space-y-1"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="text-slate-500 mb-1.5 font-medium">File paths</div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 w-10">Train</span>
          <span className="metric-value text-slate-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{form.train_path}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 w-10">Eval</span>
          <span className="metric-value text-slate-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{form.eval_path}</span>
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" style={{ color: accentColor }} />
          Registering dataset in Supabase…
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────
function StepHeader({ title, desc, accentColor }: { title: string; desc: string; accentColor: string }) {
  return (
    <div className="mb-1">
      <h3 className="text-sm font-semibold text-slate-100" style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', letterSpacing: '0.06em', color: accentColor }}>
        {title.toUpperCase()}
      </h3>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {hint && <span className="ml-1.5 text-slate-600 font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="metric-value font-medium" style={{ color: color || '#CBD5E1' }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#E2E8F0',
};
