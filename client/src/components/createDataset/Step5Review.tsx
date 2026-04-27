import { Brain, Check, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { FormData, TASK_OPTIONS, METRIC_OPTIONS, slugify } from './types';
import { StepHeader, ReviewRow } from './shared';

interface Props {
  form: FormData;
  accentColor: string;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
}

export default function Step5Review({ form, accentColor, saving, saved, saveError }: Props) {
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
