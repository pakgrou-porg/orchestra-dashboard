import React from 'react';
import { Check } from 'lucide-react';
import { FormData, TASK_OPTIONS, METRIC_OPTIONS } from './types';
import { Field, StepHeader } from './shared';

interface Props {
  form: FormData;
  set: (k: keyof FormData, v: FormData[keyof FormData]) => void;
  accentColor: string;
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#E2E8F0',
};

export default function Step2Task({ form, set, accentColor }: Props) {
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
