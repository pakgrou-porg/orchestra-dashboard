import { Plus, Trash2 } from 'lucide-react';
import { FormData, CategoryEntry, DEFAULT_COLORS } from './types';
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

export default function Step3Generation({ form, set, accentColor }: Props) {
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
