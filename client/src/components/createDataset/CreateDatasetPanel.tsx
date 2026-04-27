import { useState, useCallback, useEffect } from 'react';
import { supabase, LlmProvider } from '@/lib/supabase';
import AIRefinePanel from '@/components/AIRefinePanel';
import {
  X, ChevronRight, ChevronLeft, Check, Loader2,
  FileCode2, Shield, Brain, BarChart3, FolderOpen,
  Plus, Trash2, AlertCircle, CheckCircle2, Sparkles,
} from 'lucide-react';
import {
  FormData, TaskType, MetricType,
  DEFAULT_CATEGORIES, TASK_OPTIONS, METRIC_OPTIONS, STEPS,
  defaultFormData, slugify, deriveDefaultPaths, stepValid,
} from './types';
import { Step1Identity, Step2Task, Step3Generation, Step4Paths, Step5Review } from '.';

// ── Main Component ─────────────────────────────────────────────
type Props = { onClose: () => void; onCreated: () => void };

export default function CreateDatasetPanel({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeProvider, setActiveProvider] = useState<LlmProvider | null>(null);

  // Load the default active provider for AI Refine — prefer one with a real api_key
  useEffect(() => {
    supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const providers = data as LlmProvider[];
        const withKey = providers.filter(p => p.api_key && p.api_key.length > 10);
        const best = withKey.find(p => p.is_default)
          || withKey[0]
          || providers.find(p => p.is_default)
          || providers[0];
        setActiveProvider(best);
      });
  }, []);

  const [form, setForm] = useState<FormData>(defaultFormData());

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
            <AIRefinePanel
              taskType={form.task_type === 'custom' ? form.custom_task_type : form.task_type}
              metricType={form.metric_type === 'custom' ? form.custom_metric_type : form.metric_type}
              systemPromptTemplate={form.system_prompt_template}
              modelHint={form.model_hint}
              numTrain={form.num_train}
              numEval={form.num_eval}
              categories={form.categories}
              description={form.description}
              accentColor={accentColor}
              llmProvider={activeProvider}
              onApplySystemPrompt={(p: string) => set('system_prompt_template', p)}
              onApplyTaskType={(t: string) => set('task_type', t as TaskType)}
              onApplyMetric={(m: string) => set('metric_type', m as MetricType)}
              onApplyCategories={(cats: unknown) => set('categories', cats as FormData['categories'])}
              onContinue={() => setStep(6)}
              onSkip={() => setStep(6)}
            />
          )}
          {step === 6 && (
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
            {/* Step 5 (AI Refine) hides the footer Next button — the panel has its own CTAs */}
            {step === 5 ? null : step < 6 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!stepValid(form, step)}
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
