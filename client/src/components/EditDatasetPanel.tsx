/*
 * DESIGN: Cyberpunk Terminal / Sci-Fi Operations Dashboard
 * Reuses the same wizard structure as CreateDatasetPanel but pre-fills with existing data
 * ============================================================= */
import { useState } from 'react';
import { supabase, Dataset } from '@/lib/supabase';
import { X, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

const TASK_TYPES = [
  { value: 'sql_correction', label: 'SQL Correction', desc: 'Fix broken SQL queries' },
  { value: 'ttp_detection', label: 'TTP Detection', desc: 'Identify MITRE ATT&CK TTPs' },
  { value: 'code_generation', label: 'Code Generation', desc: 'Generate code from requirements' },
  { value: 'osquery_generation', label: 'OSQuery Generation', desc: 'Generate OSQuery SQL for endpoint monitoring' },
  { value: 'classification', label: 'Classification', desc: 'Multi-class text classification' },
  { value: 'qa', label: 'Q&A', desc: 'Question answering from context' },
  { value: 'custom', label: 'Custom', desc: 'Define your own task type' },
];

const METRICS = [
  { value: 'sql_execution_accuracy', label: 'SQL Execution Accuracy' },
  { value: 'ttp_f1', label: 'TTP F1 Score' },
  { value: 'llm_judge', label: 'LLM-as-Judge' },
  { value: 'exact_match', label: 'Exact Match' },
  { value: 'bleu', label: 'BLEU Score' },
  { value: 'rouge_l', label: 'ROUGE-L' },
  { value: 'execution_pass_rate', label: 'Execution Pass Rate' },
  { value: 'custom', label: 'Custom Metric' },
];

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
    name: dataset.name,
    version: dataset.version,
    description: dataset.description || '',
    status: dataset.status,
    task_type: dataset.task_type,
    metric_type: dataset.metric_type,
    model_hint: (genConfig.model_hint as string) || '',
    system_prompt: (genConfig.system_prompt as string) || '',
    num_train: dataset.num_train.toString(),
    num_eval: dataset.num_eval.toString(),
    format: dataset.format || 'jsonl',
    train_path: dataset.train_path,
    eval_path: dataset.eval_path,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
        ...(typeof dataset.generation_config === 'object' && dataset.generation_config !== null ? dataset.generation_config : {}),
        model_hint: form.model_hint,
        system_prompt: form.system_prompt,
      };
      const { error: err } = await supabase.from('datasets').update({
        name: form.name.trim(),
        version: form.version.trim(),
        description: form.description.trim(),
        status: form.status,
        task_type: form.task_type,
        metric_type: form.metric_type,
        num_train: parseInt(form.num_train) || dataset.num_train,
        num_eval: parseInt(form.num_eval) || dataset.num_eval,
        format: form.format,
        train_path: form.train_path.trim(),
        eval_path: form.eval_path.trim(),
        generation_config: updatedGenConfig,
        updated_at: new Date().toISOString(),
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
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4" style={{ background: 'rgba(11,17,32,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
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

          {/* Identity */}
          <div className="glass-card rounded-lg p-5">
            <div className="text-xs font-semibold text-slate-400 metric-value uppercase tracking-wider mb-4" style={{ color: '#06B6D4' }}>Identity</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Dataset Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Version</label>
                <input value={form.version} onChange={e => set('version', e.target.value)} className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none resize-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>

          {/* Task Config */}
          <div className="glass-card rounded-lg p-5">
            <div className="text-xs font-semibold text-slate-400 metric-value uppercase tracking-wider mb-4" style={{ color: '#7C3AED' }}>Task Configuration</div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Task Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TASK_TYPES.map(tt => (
                    <button key={tt.value} onClick={() => set('task_type', tt.value)}
                      className="text-left px-3 py-2 rounded text-xs transition-all"
                      style={{ background: form.task_type === tt.value ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)', border: form.task_type === tt.value ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)', color: form.task_type === tt.value ? '#A78BFA' : '#64748B' }}>
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
                      style={{ background: form.metric_type === m.value ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)', border: form.metric_type === m.value ? '1px solid rgba(6,182,212,0.35)' : '1px solid rgba(255,255,255,0.06)', color: form.metric_type === m.value ? '#06B6D4' : '#64748B' }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Model Hint</label>
                <input value={form.model_hint} onChange={e => set('model_hint', e.target.value)} placeholder="e.g., qwen3.5-9b" className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">System Prompt Template</label>
                <textarea value={form.system_prompt} onChange={e => set('system_prompt', e.target.value)} rows={6} placeholder="You are an expert in..." className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none resize-none font-mono text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>

          {/* Generation */}
          <div className="glass-card rounded-lg p-5">
            <div className="text-xs font-semibold text-slate-400 metric-value uppercase tracking-wider mb-4" style={{ color: '#10B981' }}>Generation</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Train Samples</label>
                <input value={form.num_train} onChange={e => set('num_train', e.target.value)} type="number" className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Eval Samples</label>
                <input value={form.num_eval} onChange={e => set('num_eval', e.target.value)} type="number" className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Format</label>
                <select value={form.format} onChange={e => set('format', e.target.value)} className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="jsonl">.jsonl</option>
                  <option value="json">.json</option>
                  <option value="csv">.csv</option>
                  <option value="parquet">.parquet</option>
                </select>
              </div>
            </div>
          </div>

          {/* Paths */}
          <div className="glass-card rounded-lg p-5">
            <div className="text-xs font-semibold text-slate-400 metric-value uppercase tracking-wider mb-4" style={{ color: '#F59E0B' }}>File Paths</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Train Path</label>
                <input value={form.train_path} onChange={e => set('train_path', e.target.value)} className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Eval Path</label>
                <input value={form.eval_path} onChange={e => set('eval_path', e.target.value)} className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between px-6 py-4" style={{ background: 'rgba(11,17,32,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-300 transition-all">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex items-center gap-2 px-5 py-2 rounded text-sm font-medium transition-all"
            style={{ background: success ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)', border: success ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(6,182,212,0.4)', color: success ? '#10B981' : '#06B6D4' }}
          >
            {success ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving ? 'Saving...' : success ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
