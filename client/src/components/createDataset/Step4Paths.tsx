import { FolderOpen } from 'lucide-react';
import { FormData, FormatType } from './types';
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

export default function Step4Paths({ form, set, accentColor }: Props) {
  return (
    <div className="space-y-5">
      <StepHeader title="File Paths & Format" desc="Define where the generated dataset files will be stored." accentColor={accentColor} />

      <Field label="Train File Path *" hint="Relative to the Orchestra project root">
        <input
          value={form.train_path}
          onChange={e => set('train_path', (e.target as HTMLInputElement).value)}
          placeholder="./datasets/my_dataset_v1/train.jsonl"
          className="w-full px-3 py-2 text-sm rounded outline-none text-slate-200 placeholder-slate-600"
          style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
        />
      </Field>

      <Field label="Eval File Path *">
        <input
          value={form.eval_path}
          onChange={e => set('eval_path', (e.target as HTMLInputElement).value)}
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
