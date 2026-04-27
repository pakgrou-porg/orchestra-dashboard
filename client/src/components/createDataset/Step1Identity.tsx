import { FormData } from './types';
import { Field, StepHeader } from './shared';
import { slugify } from './types';

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

export default function Step1Identity({ form, set, accentColor }: Props) {
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
