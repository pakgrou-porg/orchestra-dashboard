/*
 * DESIGN: Cyberpunk Terminal / Sci-Fi Operations Dashboard
 * EditDatasetPanel — edit a DRAFT dataset with inline AI Refine for the system prompt.
 * Fixes:
 *   1. System prompt now falls back to metadata.system_prompt and description-derived
 *      placeholder so it is never blank for older datasets.
 *   2. Inline "Refine with AI" button next to the system prompt textarea — calls the
 *      active LLM provider and streams back a refined prompt + suggestions.
 * ============================================================= */
import { useState, useEffect, useCallback } from 'react';
import { supabase, Dataset, LlmProvider } from '@/lib/supabase';
import { buildChatEndpoint, buildHeaders, parseJsonResponse } from '@/lib/llmProvider';
import {
  X, Save, AlertCircle, CheckCircle2, Sparkles, Loader2,
  RefreshCw, ChevronDown, ChevronUp, Check
} from 'lucide-react';

const TASK_TYPES = [
  { value: 'sql_correction',     label: 'SQL Correction',     desc: 'Fix broken SQL queries' },
  { value: 'ttp_detection',      label: 'TTP Detection',      desc: 'Identify MITRE ATT&CK TTPs' },
  { value: 'code_generation',    label: 'Code Generation',    desc: 'Generate code from requirements' },
  { value: 'osquery_generation', label: 'OSQuery Generation', desc: 'Generate OSQuery SQL for endpoint monitoring' },
  { value: 'classification',     label: 'Classification',     desc: 'Multi-class text classification' },
  { value: 'qa',                 label: 'Q&A',                desc: 'Question answering from context' },
  { value: 'summarization',      label: 'Summarization',      desc: 'Efficient text summarization' },
  { value: 'custom',             label: 'Custom',             desc: 'Define your own task type' },
];

const METRICS = [
  { value: 'sql_execution_accuracy', label: 'SQL Execution Accuracy' },
  { value: 'ttp_f1',                 label: 'TTP F1 Score' },
  { value: 'llm_judge',              label: 'LLM-as-Judge' },
  { value: 'exact_match',            label: 'Exact Match' },
  { value: 'bleu',                   label: 'BLEU Score' },
  { value: 'rouge_l',                label: 'ROUGE-L' },
  { value: 'execution_pass_rate',    label: 'Execution Pass Rate' },
  { value: 'custom',                 label: 'Custom Metric' },
];

// ── Resolve system prompt from any storage location ────────────
function resolveSystemPrompt(dataset: Dataset): string {
  const gc = (dataset.generation_config as Record<string, unknown>) || {};
  // Priority: system_prompt → system_prompt_template → metadata.system_prompt → ''
  for (const key of ['system_prompt', 'system_prompt_template']) {
    const val = gc[key];
    if (val && typeof val === 'string' && val.trim()) return val;
  }
  const meta = (gc.metadata as Record<string, unknown>) || {};
  if (meta.system_prompt && typeof meta.system_prompt === 'string') {
    return meta.system_prompt as string;
  }
  return '';
}

// ── Inline AI Refine sub-component ─────────────────────────────
interface RefineResult {
  refined_prompt: string;
  quality_score: number;
  suggestions: string[];
  recommended_metric?: string;
  recommended_task_type?: string;
}

function InlineAIRefine({
  currentPrompt,
  taskType,
  metricType,
  description,
  provider,
  onApply,
}: {
  currentPrompt: string;
  taskType: string;
  metricType: string;
  description: string;
  provider: LlmProvider | null;
  onApply: (refined: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<RefineResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [expanded, setExpanded] = useState(true);

  const runRefine = useCallback(async () => {
    if (!provider) {
      setErrorMsg('No active LLM provider configured. Add one via the Providers button in the header.');
      setState('error');
      return;
    }
    setState('loading');
    setErrorMsg('');
    setResult(null);

    const systemMsg = `You are an expert ML dataset designer. Analyse the provided dataset configuration and return a JSON object with these exact fields:
{
  "refined_prompt": "<improved system prompt string>",
  "quality_score": <0-100 integer>,
  "suggestions": ["<suggestion 1>", "<suggestion 2>", ...],
  "recommended_metric": "<metric_key or null>",
  "recommended_task_type": "<task_type_key or null>"
}
Return ONLY valid JSON. No markdown, no code fences.`;

    const userMsg = `Dataset configuration:
Task Type: ${taskType}
Evaluation Metric: ${metricType}
Description: ${description || '(none)'}
Current System Prompt:
${currentPrompt || '(empty — please generate a suitable one)'}

Assess quality and provide an improved system prompt. Focus on:
1. Clarity and specificity of instructions
2. Alignment between task type, metric, and prompt
3. Any missing constraints or success criteria`;

    try {
      // Use shared utility — avoids double /v1 and incorrect port injection
      const endpoint = buildChatEndpoint(provider);
      const headers  = buildHeaders(provider);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model_id,
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user',   content: userMsg },
          ],
          max_tokens: provider.max_tokens || 1024,
          temperature: provider.temperature ?? 0.3,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        const preview = txt.startsWith('<!') ? `HTTP ${res.status} — server returned HTML (check endpoint URL)` : txt.slice(0, 300);
        throw new Error(`AI API error ${res.status}: ${preview}`);
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';
      if (!raw) throw new Error('AI API returned empty response');
      const parsed: RefineResult = parseJsonResponse<RefineResult>(raw);
      setResult(parsed);
      setState('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  }, [provider, taskType, metricType, description, currentPrompt]);

  if (state === 'idle') {
    return (
      <button
        onClick={runRefine}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all mt-2"
        style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}
        title={provider ? `Refine with ${provider.display_name}` : 'Configure a provider first'}
      >
        <Sparkles size={11} />
        Refine with AI {provider ? `(${provider.display_name})` : '— no provider'}
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: '#A78BFA' }}>
        <Loader2 size={12} className="animate-spin" />
        Analysing with {provider?.display_name}…
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mt-2 p-3 rounded text-xs space-y-2" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#F87171' }}>
        <div className="flex items-center gap-1.5"><AlertCircle size={12} /> {errorMsg}</div>
        <button onClick={() => setState('idle')} className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
          <RefreshCw size={10} /> Try again
        </button>
      </div>
    );
  }

  // done
  return (
    <div className="mt-2 rounded text-xs" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.25)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2" style={{ color: '#A78BFA' }}>
          <Sparkles size={11} />
          <span>AI Analysis — Quality Score: <strong>{result?.quality_score ?? '?'}/100</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); if (result?.refined_prompt) { onApply(result.refined_prompt); setState('idle'); } }}
            className="flex items-center gap-1 px-2 py-0.5 rounded transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}
          >
            <Check size={10} /> Apply Refined Prompt
          </button>
          {expanded ? <ChevronUp size={12} style={{ color: '#64748B' }} /> : <ChevronDown size={12} style={{ color: '#64748B' }} />}
        </div>
      </div>

      {expanded && result && (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Suggestions</div>
              <ul className="space-y-1">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5" style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#7C3AED', marginTop: 1 }}>›</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Recommendations */}
          {(result.recommended_task_type || result.recommended_metric) && (
            <div className="flex gap-3 pt-1">
              {result.recommended_task_type && result.recommended_task_type !== taskType && (
                <div className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
                  Suggested task: <strong>{result.recommended_task_type}</strong>
                </div>
              )}
              {result.recommended_metric && result.recommended_metric !== metricType && (
                <div className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06B6D4' }}>
                  Suggested metric: <strong>{result.recommended_metric}</strong>
                </div>
              )}
            </div>
          )}
          {/* Refined prompt preview */}
          <div>
            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Refined Prompt Preview</div>
            <pre className="text-xs p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap" style={{ background: 'rgba(0,0,0,0.3)', color: '#A78BFA', fontFamily: 'JetBrains Mono, monospace' }}>
              {result.refined_prompt}
            </pre>
          </div>
          <button onClick={() => setState('idle')} className="text-xs" style={{ color: '#475569' }}>
            ← Run again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main EditDatasetPanel ───────────────────────────────────────
export default function EditDatasetPanel({
  dataset,
  onClose,
  onSaved,
}: {
  dataset: Dataset;
  onClose: () => void;
  onSaved: () => void;
}) {
  const genConfig = (dataset.generation_config as Record<string, unknown>) || {};

  const [form, setForm] = useState({
    name:          dataset.name,
    version:       dataset.version,
    description:   dataset.description || '',
    status:        dataset.status,
    task_type:     dataset.task_type,
    metric_type:   dataset.metric_type,
    model_hint:    (genConfig.model_hint as string) || '',
    system_prompt: resolveSystemPrompt(dataset),
    num_train:     dataset.num_train.toString(),
    num_eval:      dataset.num_eval.toString(),
    format:        dataset.format || 'jsonl',
    train_path:    dataset.train_path,
    eval_path:     dataset.eval_path,
  });

  const [activeProvider, setActiveProvider] = useState<LlmProvider | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch the active LLM provider — prefer one with a real api_key
  useEffect(() => {
    supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const providers = data as LlmProvider[];
        // Prefer: has real api_key → is_default → first active
        const withKey = providers.filter(p => p.api_key && p.api_key.length > 10);
        const best = withKey.find(p => p.is_default)
          || withKey[0]
          || providers.find(p => p.is_default)
          || providers[0];
        setActiveProvider(best);
      });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.task_type || !form.metric_type) {
      setError('Name, task type, and metric are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updatedGenConfig = {
        ...(typeof dataset.generation_config === 'object' && dataset.generation_config !== null
          ? dataset.generation_config
          : {}),
        model_hint:    form.model_hint,
        system_prompt: form.system_prompt,
      };
      const { error: err } = await supabase.from('datasets').update({
        name:              form.name.trim(),
        version:           form.version.trim(),
        description:       form.description.trim(),
        status:            form.status,
        task_type:         form.task_type,
        metric_type:       form.metric_type,
        num_train:         parseInt(form.num_train) || dataset.num_train,
        num_eval:          parseInt(form.num_eval)  || dataset.num_eval,
        format:            form.format,
        train_path:        form.train_path.trim(),
        eval_path:         form.eval_path.trim(),
        generation_config: updatedGenConfig,
        updated_at:        new Date().toISOString(),
      }).eq('id', dataset.id);
      if (err) throw new Error(err.message);
      setSuccess(true);
      setTimeout(() => { onSaved(); }, 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="ml-auto w-full max-w-2xl h-full overflow-y-auto flex flex-col" style={{ background: '#0B1120', borderLeft: '1px solid rgba(6,182,212,0.2)' }}>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ background: 'rgba(11,17,32,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
          <div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', fontWeight: 700, color: '#06B6D4', letterSpacing: '0.12em' }}>EDIT DATASET</div>
            <div className="text-xs text-slate-500 mt-0.5 metric-value">{dataset.name}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 transition-all" style={{ color: '#64748B' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">
          {error && (
            <div className="p-3 rounded flex items-center gap-2 text-sm" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#F43F5E' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded flex items-center gap-2 text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}>
              <CheckCircle2 size={14} /> Dataset updated successfully!
            </div>
          )}

          {/* ── Identity ── */}
          <div className="glass-card rounded-lg p-5">
            <div className="text-xs font-semibold metric-value uppercase tracking-wider mb-4" style={{ color: '#06B6D4' }}>Identity</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Dataset Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Version</label>
                <input value={form.version} onChange={e => set('version', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 outline-none metric-value"
                  style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>

          {/* ── Task Config ── */}
          <div className="glass-card rounded-lg p-5">
            <div className="text-xs font-semibold metric-value uppercase tracking-wider mb-4" style={{ color: '#7C3AED' }}>Task Configuration</div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Task Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TASK_TYPES.map(tt => (
                    <button key={tt.value} onClick={() => set('task_type', tt.value)}
                      className="text-left px-3 py-2 rounded text-xs transition-all"
                      style={{
                        background: form.task_type === tt.value ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                        border: form.task_type === tt.value ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                        color: form.task_type === tt.value ? '#A78BFA' : '#64748B',
                      }}>
                      <div className="font-medium">{tt.label}</div>
                      <div className="text-slate-600 text-xs mt-0.5">{tt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Evaluation Metric</label>
                <div className="grid grid-cols-2 gap-2">
                  {METRICS.map(m => (
                    <button key={m.value} onClick={() => set('metric_type', m.value)}
                      className="text-left px-3 py-2 rounded text-xs transition-all"
                      style={{
                        background: form.metric_type === m.value ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)',
                        border: form.metric_type === m.value ? '1px solid rgba(6,182,212,0.35)' : '1px solid rgba(255,255,255,0.06)',
                        color: form.metric_type === m.value ? '#06B6D4' : '#64748B',
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Model Hint</label>
                <input value={form.model_hint} onChange={e => set('model_hint', e.target.value)}
                  placeholder="e.g., qwen3.5-9b"
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>

              {/* System Prompt with inline AI Refine */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-500 metric-value uppercase tracking-wider">System Prompt Template</label>
                  {activeProvider && (
                    <span className="text-xs metric-value" style={{ color: '#475569' }}>
                      Provider: <span style={{ color: '#7C3AED' }}>{activeProvider.display_name}</span>
                    </span>
                  )}
                </div>
                <textarea
                  value={form.system_prompt}
                  onChange={e => set('system_prompt', e.target.value)}
                  rows={8}
                  placeholder="You are an expert in... (describe the task, constraints, and success criteria)"
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none resize-y font-mono text-xs"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '120px' }}
                />
                <InlineAIRefine
                  currentPrompt={form.system_prompt}
                  taskType={form.task_type}
                  metricType={form.metric_type}
                  description={form.description}
                  provider={activeProvider}
                  onApply={refined => set('system_prompt', refined)}
                />
              </div>
            </div>
          </div>

          {/* ── Generation ── */}
          <div className="glass-card rounded-lg p-5">
            <div className="text-xs font-semibold metric-value uppercase tracking-wider mb-4" style={{ color: '#10B981' }}>Generation</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Train Samples</label>
                <input value={form.num_train} onChange={e => set('num_train', e.target.value)} type="number"
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Eval Samples</label>
                <input value={form.num_eval} onChange={e => set('num_eval', e.target.value)} type="number"
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Format</label>
                <select value={form.format} onChange={e => set('format', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 outline-none metric-value"
                  style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="jsonl">.jsonl</option>
                  <option value="json">.json</option>
                  <option value="csv">.csv</option>
                  <option value="parquet">.parquet</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Paths ── */}
          <div className="glass-card rounded-lg p-5">
            <div className="text-xs font-semibold metric-value uppercase tracking-wider mb-4" style={{ color: '#F59E0B' }}>File Paths</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Train Path</label>
                <input value={form.train_path} onChange={e => set('train_path', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Eval Path</label>
                <input value={form.eval_path} onChange={e => set('eval_path', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between px-6 py-4"
          style={{ background: 'rgba(11,17,32,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-300 transition-all">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex items-center gap-2 px-5 py-2 rounded text-sm font-medium transition-all"
            style={{
              background: success ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)',
              border: success ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(6,182,212,0.4)',
              color: success ? '#10B981' : '#06B6D4',
            }}
          >
            {success ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : success ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
