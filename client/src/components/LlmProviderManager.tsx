/*
 * DESIGN: Cyberpunk Terminal / Sci-Fi Operations Dashboard
 * Dark navy-black, glass morphism, cyan/violet neon accents
 * Orbitron headers, JetBrains Mono metrics, Inter body
 * ============================================================= */
import { useState } from 'react';
import { supabase, LlmProvider } from '@/lib/supabase';
import {
  X, Plus, Trash2, CheckCircle2, AlertCircle, Wifi, Globe,
  Server, Key, Edit2, Save, ToggleLeft, ToggleRight, Star, StarOff
} from 'lucide-react';

const PROVIDER_TYPES = [
  { value: 'lmstudio_local', label: 'LMStudio (localhost)', icon: '🖥️', color: '#10B981', needsKey: false, needsUrl: false, needsPort: true, urlPlaceholder: 'http://localhost', defaultPort: 1234 },
  { value: 'lmstudio_network', label: 'LMStudio (network)', icon: '🌐', color: '#06B6D4', needsKey: false, needsUrl: true, needsPort: true, urlPlaceholder: 'http://192.168.1.x', defaultPort: 1234 },
  { value: 'openrouter', label: 'OpenRouter', icon: '🔀', color: '#7C3AED', needsKey: true, needsUrl: false, needsPort: false, urlPlaceholder: 'https://openrouter.ai/api/v1', defaultPort: null },
  { value: 'venice', label: 'Venice.ai', icon: '🎭', color: '#F59E0B', needsKey: true, needsUrl: false, needsPort: false, urlPlaceholder: 'https://api.venice.ai/api/v1', defaultPort: null },
  { value: 'anthropic', label: 'Anthropic', icon: '🤖', color: '#EC4899', needsKey: true, needsUrl: false, needsPort: false, urlPlaceholder: 'https://api.anthropic.com/v1', defaultPort: null },
  { value: 'openai', label: 'OpenAI', icon: '⚡', color: '#22C55E', needsKey: true, needsUrl: false, needsPort: false, urlPlaceholder: 'https://api.openai.com/v1', defaultPort: null },
  { value: 'gemini', label: 'Google Gemini', icon: '💎', color: '#3B82F6', needsKey: true, needsUrl: false, needsPort: false, urlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta', defaultPort: null },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', icon: '🔧', color: '#94A3B8', needsKey: true, needsUrl: true, needsPort: true, urlPlaceholder: 'http://your-server/v1', defaultPort: 8080 },
] as const;

type ProviderTypeValue = typeof PROVIDER_TYPES[number]['value'];

const POPULAR_MODELS: Record<ProviderTypeValue, string[]> = {
  lmstudio_local: ['local-model', 'llama-3.2-3b-instruct', 'qwen2.5-7b-instruct', 'phi-4-mini'],
  lmstudio_network: ['local-model', 'llama-3.2-3b-instruct', 'qwen2.5-7b-instruct'],
  openrouter: ['qwen/qwen-2.5-72b-instruct', 'qwen/qwen3.5-397b', 'meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-001'],
  venice: ['llama-3.3-70b', 'mistral-31-24b', 'qwen-2.5-vl-72b'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  gemini: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-flash'],
  custom: [],
};

type FormData = {
  display_name: string;
  provider_type: ProviderTypeValue;
  model_id: string;
  base_url: string;
  port: string;
  api_key: string;
  context_length: string;
  max_tokens: string;
  temperature: string;
  capabilities: string[];
};

const DEFAULT_FORM: FormData = {
  display_name: '',
  provider_type: 'lmstudio_local',
  model_id: '',
  base_url: '',
  port: '1234',
  api_key: '',
  context_length: '4096',
  max_tokens: '2048',
  temperature: '0.7',
  capabilities: ['chat'],
};

function providerTypeInfo(type: string) {
  return PROVIDER_TYPES.find(p => p.value === type) || PROVIDER_TYPES[0];
}

function ProviderCard({
  provider,
  onEdit,
  onDelete,
  onToggleActive,
  onSetDefault,
}: {
  provider: LlmProvider;
  onEdit: (p: LlmProvider) => void;
  onDelete: (id: string) => void;
  onToggleActive: (p: LlmProvider) => void;
  onSetDefault: (p: LlmProvider) => void;
}) {
  const info = providerTypeInfo(provider.provider_type);
  return (
    <div
      className="glass-card rounded-lg p-4 relative"
      style={{
        border: provider.is_default
          ? `1px solid ${info.color}60`
          : '1px solid rgba(255,255,255,0.06)',
        opacity: provider.is_active ? 1 : 0.55,
      }}
    >
      {provider.is_default && (
        <div className="absolute top-2 right-2">
          <span className="text-xs metric-value px-1.5 py-0.5 rounded" style={{ background: `${info.color}20`, color: info.color, border: `1px solid ${info.color}40` }}>DEFAULT</span>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="text-xl mt-0.5">{info.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-slate-200 text-sm truncate">{provider.display_name}</span>
          </div>
          <div className="text-xs metric-value truncate" style={{ color: info.color }}>{provider.model_id}</div>
          <div className="text-xs text-slate-500 mt-1">
            {info.label}
            {provider.base_url && <span className="ml-2 text-slate-600">{provider.base_url}{provider.port ? `:${provider.port}` : ''}</span>}
            {provider.api_key_hint && <span className="ml-2 text-slate-600">key: {provider.api_key_hint}</span>}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(provider.capabilities || []).map(cap => (
              <span key={cap} className="text-xs px-1.5 py-0.5 rounded metric-value" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}>{cap}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
        <button onClick={() => onEdit(provider)} className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all hover:bg-white/5" style={{ color: '#06B6D4' }}>
          <Edit2 size={11} /> Edit
        </button>
        <button onClick={() => onSetDefault(provider)} className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all hover:bg-white/5" style={{ color: provider.is_default ? '#F59E0B' : '#64748B' }} title={provider.is_default ? 'Default provider' : 'Set as default'}>
          {provider.is_default ? <Star size={11} /> : <StarOff size={11} />}
          {provider.is_default ? 'Default' : 'Set Default'}
        </button>
        <button onClick={() => onToggleActive(provider)} className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all hover:bg-white/5" style={{ color: provider.is_active ? '#10B981' : '#64748B' }}>
          {provider.is_active ? <ToggleRight size={11} /> : <ToggleLeft size={11} />}
          {provider.is_active ? 'Active' : 'Inactive'}
        </button>
        <button onClick={() => onDelete(provider.id)} className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all hover:bg-white/5 ml-auto" style={{ color: '#F43F5E' }}>
          <Trash2 size={11} /> Remove
        </button>
      </div>
    </div>
  );
}

function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: LlmProvider;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>(initial ? {
    display_name: initial.display_name,
    provider_type: initial.provider_type,
    model_id: initial.model_id,
    base_url: initial.base_url || '',
    port: initial.port?.toString() || '',
    api_key: '',
    context_length: initial.context_length.toString(),
    max_tokens: initial.max_tokens.toString(),
    temperature: initial.temperature.toString(),
    capabilities: initial.capabilities || ['chat'],
  } : { ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeInfo = providerTypeInfo(form.provider_type);
  const popularModels = POPULAR_MODELS[form.provider_type as ProviderTypeValue] || [];

  const set = (k: keyof FormData, v: string | string[]) => setForm(f => ({ ...f, [k]: v }));

  const toggleCap = (cap: string) => {
    set('capabilities', form.capabilities.includes(cap)
      ? form.capabilities.filter(c => c !== cap)
      : [...form.capabilities, cap]);
  };

  const handleSave = async () => {
    if (!form.display_name.trim() || !form.model_id.trim()) {
      setError('Display name and model ID are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        display_name: form.display_name.trim(),
        provider_type: form.provider_type,
        model_id: form.model_id.trim(),
        base_url: form.base_url.trim() || typeInfo.urlPlaceholder,
        port: form.port ? parseInt(form.port) : null,
        api_key_hint: form.api_key ? `${form.api_key.slice(0, 6)}...${form.api_key.slice(-4)}` : null,
        context_length: parseInt(form.context_length) || 4096,
        max_tokens: parseInt(form.max_tokens) || 2048,
        temperature: parseFloat(form.temperature) || 0.7,
        capabilities: form.capabilities,
        name: `${form.provider_type}_${form.model_id.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`,
      };

      let res;
      if (initial) {
        res = await supabase.from('llm_providers').update(payload).eq('id', initial.id);
      } else {
        res = await supabase.from('llm_providers').insert(payload);
      }
      if (res.error) throw new Error(res.error.message);
      onSave();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-lg p-5" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="text-lg">{typeInfo.icon}</div>
        <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'Orbitron, monospace', letterSpacing: '0.05em' }}>
          {initial ? 'EDIT PROVIDER' : 'ADD PROVIDER'}
        </h3>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded flex items-center gap-2 text-sm" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#F43F5E' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Provider Type */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Provider Type</label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDER_TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => {
                  set('provider_type', pt.value);
                  if (pt.defaultPort) set('port', pt.defaultPort.toString());
                  set('base_url', pt.urlPlaceholder);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded text-xs text-left transition-all"
                style={{
                  background: form.provider_type === pt.value ? `${pt.color}15` : 'rgba(255,255,255,0.03)',
                  border: form.provider_type === pt.value ? `1px solid ${pt.color}50` : '1px solid rgba(255,255,255,0.06)',
                  color: form.provider_type === pt.value ? pt.color : '#64748B',
                }}
              >
                <span>{pt.icon}</span>
                <span className="truncate">{pt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Display Name</label>
          <input
            value={form.display_name}
            onChange={e => set('display_name', e.target.value)}
            placeholder={`e.g., ${typeInfo.label} — Production`}
            className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>

        {/* Model ID */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Model ID</label>
          <input
            value={form.model_id}
            onChange={e => set('model_id', e.target.value)}
            placeholder="e.g., qwen/qwen-2.5-72b-instruct"
            className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          {popularModels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {popularModels.map(m => (
                <button key={m} onClick={() => set('model_id', m)} className="text-xs px-2 py-0.5 rounded transition-all hover:bg-white/5" style={{ color: '#06B6D4', border: '1px solid rgba(6,182,212,0.2)' }}>{m}</button>
              ))}
            </div>
          )}
        </div>

        {/* URL + Port */}
        {(typeInfo.needsUrl || typeInfo.needsPort) && (
          <div className="grid grid-cols-3 gap-3">
            {typeInfo.needsUrl && (
              <div className={typeInfo.needsPort ? 'col-span-2' : 'col-span-3'}>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Base URL</label>
                <input
                  value={form.base_url}
                  onChange={e => set('base_url', e.target.value)}
                  placeholder={typeInfo.urlPlaceholder}
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            )}
            {typeInfo.needsPort && (
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Port</label>
                <input
                  value={form.port}
                  onChange={e => set('port', e.target.value)}
                  placeholder="1234"
                  type="number"
                  className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            )}
          </div>
        )}

        {/* API Key */}
        {typeInfo.needsKey && (
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">
              API Key {initial?.api_key_hint && <span className="text-slate-600 normal-case">(current: {initial.api_key_hint})</span>}
            </label>
            <input
              value={form.api_key}
              onChange={e => set('api_key', e.target.value)}
              type="password"
              placeholder={initial ? 'Leave blank to keep existing key' : 'sk-...'}
              className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <p className="text-xs text-slate-600 mt-1">Only the first/last 4 chars are stored as a hint. The full key is never persisted in Supabase.</p>
          </div>
        )}

        {/* Advanced: context, max_tokens, temperature */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'context_length', label: 'Context Length', placeholder: '4096' },
            { key: 'max_tokens', label: 'Max Tokens', placeholder: '2048' },
            { key: 'temperature', label: 'Temperature', placeholder: '0.7' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">{label}</label>
              <input
                value={form[key as keyof FormData] as string}
                onChange={e => set(key as keyof FormData, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded text-sm text-slate-200 bg-transparent outline-none metric-value"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          ))}
        </div>

        {/* Capabilities */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 metric-value uppercase tracking-wider">Capabilities</label>
          <div className="flex flex-wrap gap-2">
            {['chat', 'completion', 'refine', 'judge', 'embedding'].map(cap => (
              <button
                key={cap}
                onClick={() => toggleCap(cap)}
                className="text-xs px-2.5 py-1 rounded transition-all metric-value"
                style={{
                  background: form.capabilities.includes(cap) ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.03)',
                  border: form.capabilities.includes(cap) ? '1px solid rgba(6,182,212,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: form.capabilities.includes(cap) ? '#06B6D4' : '#64748B',
                }}
              >
                {cap}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all"
          style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.4)', color: '#06B6D4' }}
        >
          <Save size={13} />
          {saving ? 'Saving...' : initial ? 'Update Provider' : 'Add Provider'}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-300 transition-all">Cancel</button>
      </div>
    </div>
  );
}

export default function LlmProviderManager({
  providers,
  onClose,
  onRefresh,
}: {
  providers: LlmProvider[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editProvider, setEditProvider] = useState<LlmProvider | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('llm_providers').delete().eq('id', id);
    setDeleting(null);
    onRefresh();
  };

  const handleToggleActive = async (p: LlmProvider) => {
    await supabase.from('llm_providers').update({ is_active: !p.is_active }).eq('id', p.id);
    onRefresh();
  };

  const handleSetDefault = async (p: LlmProvider) => {
    // Clear all defaults, then set this one
    await supabase.from('llm_providers').update({ is_default: false }).neq('id', '');
    await supabase.from('llm_providers').update({ is_default: true }).eq('id', p.id);
    onRefresh();
  };

  const activeProviders = providers.filter(p => p.is_active);
  const inactiveProviders = providers.filter(p => !p.is_active);

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="ml-auto w-full max-w-2xl h-full overflow-y-auto flex flex-col" style={{ background: '#0B1120', borderLeft: '1px solid rgba(6,182,212,0.2)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4" style={{ background: 'rgba(11,17,32,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
          <div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', fontWeight: 700, color: '#06B6D4', letterSpacing: '0.12em' }}>LLM PROVIDER MANAGER</div>
            <div className="text-xs text-slate-500 mt-0.5">{providers.length} provider{providers.length !== 1 ? 's' : ''} configured · {activeProviders.length} active</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowForm(true); setEditProvider(null); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
              style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#06B6D4' }}
            >
              <Plus size={12} /> Add Provider
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 transition-all" style={{ color: '#64748B' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Add / Edit Form */}
          {(showForm || editProvider) && (
            <ProviderForm
              initial={editProvider || undefined}
              onSave={() => { setShowForm(false); setEditProvider(null); onRefresh(); }}
              onCancel={() => { setShowForm(false); setEditProvider(null); }}
            />
          )}

          {/* Provider list */}
          {providers.length === 0 && !showForm ? (
            <div className="glass-card rounded-lg p-8 text-center">
              <Server size={32} className="mx-auto mb-3 text-slate-600" />
              <div className="text-slate-400 text-sm mb-1">No providers configured</div>
              <div className="text-slate-600 text-xs">Add a local LMStudio instance or cloud API to get started.</div>
            </div>
          ) : (
            <>
              {activeProviders.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={13} style={{ color: '#10B981' }} />
                    <span className="text-xs font-medium text-slate-400 metric-value uppercase tracking-wider">Active Providers</span>
                  </div>
                  <div className="space-y-3">
                    {activeProviders.map(p => (
                      <ProviderCard
                        key={p.id}
                        provider={p}
                        onEdit={p => { setEditProvider(p); setShowForm(false); }}
                        onDelete={id => { if (deleting !== id) handleDelete(id); }}
                        onToggleActive={handleToggleActive}
                        onSetDefault={handleSetDefault}
                      />
                    ))}
                  </div>
                </div>
              )}
              {inactiveProviders.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={13} style={{ color: '#64748B' }} />
                    <span className="text-xs font-medium text-slate-500 metric-value uppercase tracking-wider">Inactive Providers</span>
                  </div>
                  <div className="space-y-3">
                    {inactiveProviders.map(p => (
                      <ProviderCard
                        key={p.id}
                        provider={p}
                        onEdit={p => { setEditProvider(p); setShowForm(false); }}
                        onDelete={id => { if (deleting !== id) handleDelete(id); }}
                        onToggleActive={handleToggleActive}
                        onSetDefault={handleSetDefault}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Provider type reference */}
          <div className="glass-card rounded-lg p-4">
            <div className="text-xs font-medium text-slate-500 metric-value uppercase tracking-wider mb-3">Supported Provider Types</div>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDER_TYPES.map(pt => (
                <div key={pt.value} className="flex items-center gap-2 text-xs">
                  <span>{pt.icon}</span>
                  <span style={{ color: pt.color }}>{pt.label}</span>
                  <span className="text-slate-600 ml-auto">{pt.needsKey ? <Key size={10} /> : <Wifi size={10} />}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1"><Key size={10} /> API key required</span>
              <span className="flex items-center gap-1"><Wifi size={10} /> Network/local only</span>
              <span className="flex items-center gap-1"><Globe size={10} /> Cloud API</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
