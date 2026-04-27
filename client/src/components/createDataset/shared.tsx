import React from 'react';

export function StepHeader({ title, desc, accentColor }: { title: string; desc: string; accentColor: string }) {
  return (
    <div className="mb-1">
      <h3 className="text-sm font-semibold text-slate-100" style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', letterSpacing: '0.06em', color: accentColor }}>
        {title.toUpperCase()}
      </h3>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

export function ReviewRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="metric-value font-medium" style={{ color: color || '#CBD5E1' }}>{value}</span>
    </div>
  );
}
