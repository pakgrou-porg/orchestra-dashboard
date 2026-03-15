/*
 * DESIGN: Cyberpunk Terminal / Sci-Fi Operations Dashboard
 * Dark navy-black, glass morphism, cyan/violet neon accents
 * Orbitron headers, JetBrains Mono metrics, Inter body
 * ============================================================= */
import { useState, useEffect } from 'react';
import { supabase, LlmProvider } from '@/lib/supabase';
import {
  X, Plus, Trash2, CheckCircle2, AlertCircle, Wifi, Globe,
  Server, Key, Edit2, Save, ToggleLeft, ToggleRight, Star, StarOff,
  Zap, Loader2
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
  openrouter: [
    'anthropic/claude-3.7-sonnet',
    'anthropic/claude-3.5-haiku',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001',
    'deepseek/deepseek-chat-v3-0324',
    'meta-llama/llama-3.3-70b-instruct',
    'qwen/qwen-2.5-72b-instruct',
  ],
  venice: ['llama-3.3-70b', 'deepseek-r1-671b', 'mistral-31-24b', 'qwen-2.5-vl-72b'],
  anthropic: ['claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
  gemini: ['gemini-2.5-pro-preview-03-25', 'gemini-2.0-flash', 'gemini-2.0-pro-exp-02-05'],
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
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');

  const handleTest = async () => {
    setTestState('testing');
    setTestMsg('');
    try {
      const { buildChatEndpoint, buildHeaders } = await import('@/lib/llmProvider');
      const endpoint = buildChatEndpoint(provider);
      const headers = buildHeaders(provider);
      const t0 = Date.now();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model_id,
          messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
          max_tokens: 8,
          temperature: 0,
        }),
      });
      const ms = Date.now() - t0;
      if (!res.ok) {
        const txt = await res.text();
        const preview = txt.startsWith('<!') ? `HTTP ${res.status}` : txt.slice(0, 120);
        throw new Error(preview);
      }
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '(empty)';
      setTestMsg(`${ms}ms — "${reply.trim().slice(0, 40)}"`);
      setTestState('ok');
    } catch (err: unknown) {
      setTestMsg(err instanceof Error ? err.message.slice(0, 120) : 'Unknown error');
      setTestState('fail');
    }
    setTimeout(() => setTestState('idle'), 8000);
  };

  const hasKey = !!(provider.api_key && provider.api_key.length > 10);

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
            {!hasKey && info.needsKey && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}>NO KEY</span>
            )}
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
          {testState !== 'idle' && (
            <div className="mt-2 text-xs px-2 py-1 rounded flex items-center gap-1.5" style={{
              background: testState === 'ok' ? 'rgba(16,185,129,0.08)' : testState === 'fail' ? 'rgba(244,63,94,0.08)' : 'rgba(6,182,212,0.08)',
              border: `1px solid ${testState === 'ok' ? 'rgba(16,185,129,0.25)' : testState === 'fail' ? 'rgba(244,63,94,0.25)' : 'rgba(6,182,212,0.25)'}`,
              color: testState === 'ok' ? '#10B981' : testState === 'fail' ? '#F43F5E' : '#06B6D4',
            }}>
              {testState === 'testing' && <Loader2 size={10} className="animate-spin" />}
              {testState === 'ok' && <CheckCircle2 size={10} />}
              {testState === 'fail' && <AlertCircle size={10} />}
              {testState === 'testing' ? 'Testing connection…' : testMsg}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
        <button onClick={() => onEdit(provider)} className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all hover:bg-white/5" style={{ color: '#06B6D4' }}>
          <Edit2 size={11} /> Edit
        </button>
        <button
          onClick={handleTest}
          disabled={testState === 'testing'}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all hover:bg-white/5"
          style={{ color: testState === 'ok' ? '#10B981' : testState === 'fail' ? '#F43F5E' : '#A78BFA' }}
          title={!hasKey && info.needsKey ? 'No API key — edit to add one' : 'Test connection'}
        >
          {testState === 'testing' ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          Test
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
      const payload: Record<string, unknown> = {
        display_name: form.display_name.trim(),
        provider_type: form.provider_type,
        model_id: form.model_id.trim(),
        base_url: form.base_url.trim() || typeInfo.urlPlaceholder,
        port: form.port ? parseInt(form.port) : null,
        api_key_hint: form.api_key ? `${form.api_key.slice(0, 6)}...${form.api_key.slice(-4)}` : (initial?.api_key_hint ?? null),
        context_length: parseInt(form.context_length) || 4096,
        max_tokens: parseInt(form.max_tokens) || 2048,
        temperature: parseFloat(form.temperature) || 0.7,
        capabilities: form.capabilities,
        name: `${form.provider_type}_${form.model_id.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`,
      };
      // Store actual API key if provided (never blank out an existing key on edit)
      if (form.api_key.trim()) {
        payload.api_key = form.api_key.trim();
      }

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
            <p className="text-xs text-slate-600 mt-1">Key is stored in Supabase (RLS-protected). A masked hint is shown in the UI for reference.</p>
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

// ── Quick Setup presets ───────────────────────────────────────
const QUICK_SETUP_PRESETS = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    icon: '🔀',
    color: '#7C3AED',
    provider_type: 'openrouter' as const,
    base_url: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet' },
      { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
      { id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek Chat V3' },
    ],
    keyPrefix: 'sk-or-',
    keyHint: 'sk-or-v1-...',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    icon: '🤖',
    color: '#EC4899',
    provider_type: 'anthropic' as const,
    base_url: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    ],
    keyPrefix: 'sk-ant-',
    keyHint: 'sk-ant-api03-...',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    icon: '⚡',
    color: '#22C55E',
    provider_type: 'openai' as const,
    base_url: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'o3-mini', label: 'o3-mini' },
    ],
    keyPrefix: 'sk-',
    keyHint: 'sk-...',
  },
  {
    id: 'google_gemini',
    label: 'Google Gemini',
    icon: '💎',
    color: '#3B82F6',
    provider_type: 'gemini' as const,
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-pro-preview-03-25', label: 'Gemini 2.5 Pro Preview' },
    ],
    keyPrefix: 'AIza',
    keyHint: 'AIzaSy...',
  },
  {
    id: 'venice',
    label: 'Venice.ai',
    icon: '🎭',
    color: '#F59E0B',
    provider_type: 'venice' as const,
    base_url: 'https://api.venice.ai/api/v1',
    models: [
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
      { id: 'deepseek-r1-671b', label: 'DeepSeek R1 671B' },
    ],
    keyPrefix: '',
    keyHint: 'venice-...',
  },
];

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
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickPreset, setQuickPreset] = useState<typeof QUICK_SETUP_PRESETS[0] | null>(null);
  const [quickKey, setQuickKey] = useState('');
  const [quickModel, setQuickModel] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickSuccess, setQuickSuccess] = useState(false);
  // Dynamic OpenRouter model list
  const [orModels, setOrModels] = useState<{ id: string; label: string }[] | null>(null);
  const [orLoading, setOrLoading] = useState(false);

  // Fetch OpenRouter model list when Quick Setup opens
  useEffect(() => {
    if (!showQuickSetup || orModels !== null) return;
    setOrLoading(true);
    fetch('https://openrouter.ai/api/v1/models')
      .then(r => r.json())
      .then((data: { data?: { id: string; name?: string; created?: number }[] }) => {
        const all = data.data || [];
        // Filter to major providers, sort by created desc, take top 40
        const major = all.filter(m =>
          ['anthropic/', 'openai/', 'google/', 'deepseek/', 'meta-llama/', 'qwen/', 'x-ai/'].some(p => m.id.startsWith(p))
        );
        const sorted = major.sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 40);
        setOrModels(sorted.map(m => ({ id: m.id, label: m.name || m.id })));
      })
      .catch(() => setOrModels(null))
      .finally(() => setOrLoading(false));
  }, [showQuickSetup, orModels]);

  const handleQuickSetup = async () => {
    if (!quickPreset || !quickKey.trim() || !quickModel) {
      setQuickError('Select a provider, choose a model, and paste your API key.');
      return;
    }
    setQuickSaving(true);
    setQuickError(null);
    try {
      const modelLabel = quickPreset.models.find(m => m.id === quickModel)?.label || quickModel;
      const payload = {
        display_name: `${quickPreset.label} — ${modelLabel}`,
        provider_type: quickPreset.provider_type,
        model_id: quickModel,
        base_url: quickPreset.base_url,
        port: null,
        api_key: quickKey.trim(),
        api_key_hint: `${quickKey.trim().slice(0, 8)}...${quickKey.trim().slice(-4)}`,
        context_length: 128000,
        max_tokens: 4096,
        temperature: 0.3,
        capabilities: ['chat', 'json_mode'],
        is_active: true,
        is_default: providers.length === 0,
        quick_register_source: quickPreset.id,
        name: `${quickPreset.provider_type}_${quickModel.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`,
      };
      const { error } = await supabase.from('llm_providers').insert(payload);
      if (error) throw new Error(error.message);
      setQuickSuccess(true);
      setTimeout(() => {
        setShowQuickSetup(false);
        setQuickPreset(null);
        setQuickKey('');
        setQuickModel('');
        setQuickSuccess(false);
        onRefresh();
      }, 1500);
    } catch (err: unknown) {
      setQuickError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setQuickSaving(false);
    }
  };

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
              onClick={() => { setShowQuickSetup(q => !q); setShowForm(false); setEditProvider(null); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
              style={{ background: showQuickSetup ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.35)', color: '#A78BFA' }}
            >
              <Zap size={12} /> Quick Setup
            </button>
            <button
              onClick={() => { setShowForm(true); setEditProvider(null); setShowQuickSetup(false); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
              style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#06B6D4' }}
            >
              <Plus size={12} /> Manual
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 transition-all" style={{ color: '#64748B' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Quick Setup Panel */}
          {showQuickSetup && !showForm && !editProvider && (
            <div className="rounded-lg p-5 space-y-4" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <div className="flex items-center gap-2">
                <Zap size={14} style={{ color: '#A78BFA' }} />
                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.65rem', color: '#A78BFA', letterSpacing: '0.1em' }}>QUICK SETUP — REGISTER API KEY</span>
              </div>
              <p className="text-xs text-slate-500">Choose a provider, pick a model, paste your API key. A provider will be created and activated automatically.</p>

              {/* Provider tiles */}
              <div className="grid grid-cols-3 gap-2">
                {QUICK_SETUP_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => { setQuickPreset(preset); setQuickModel(preset.models[0].id); setQuickKey(''); setQuickError(null); setQuickSuccess(false); }}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded text-center transition-all"
                    style={{
                      background: quickPreset?.id === preset.id ? `${preset.color}18` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${quickPreset?.id === preset.id ? preset.color + '55' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <span className="text-xs" style={{ color: quickPreset?.id === preset.id ? preset.color : '#64748B' }}>{preset.label}</span>
                  </button>
                ))}
              </div>

              {quickPreset && (
                <>
                  {/* Model selector — dynamic for OpenRouter, static for others */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-500">Model</label>
                      {quickPreset.id === 'openrouter' && (
                        <span className="text-xs" style={{ color: orLoading ? '#06B6D4' : orModels ? '#10B981' : '#64748B' }}>
                          {orLoading ? '⟳ Fetching from OpenRouter…' : orModels ? `${orModels.length} models live` : 'Using cached list'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {(quickPreset.id === 'openrouter' && (orModels || orLoading)
                        ? (orModels || [])
                        : quickPreset.models
                      ).map(m => (
                        <button
                          key={m.id}
                          onClick={() => setQuickModel(m.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-all"
                          style={{
                            background: quickModel === m.id ? `${quickPreset.color}12` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${quickModel === m.id ? quickPreset.color + '44' : 'rgba(255,255,255,0.07)'}`,
                            color: quickModel === m.id ? '#E2E8F0' : '#64748B',
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: quickModel === m.id ? quickPreset.color : 'rgba(255,255,255,0.15)' }} />
                          <span className="font-mono truncate flex-1">{m.label}</span>
                          <span className="text-slate-600 shrink-0" style={{ fontSize: '0.6rem' }}>{m.id}</span>
                        </button>
                      ))}
                      {quickPreset.id === 'openrouter' && orLoading && (
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                          <Loader2 size={11} className="animate-spin" /> Loading latest models from OpenRouter…
                        </div>
                      )}
                    </div>
                    {/* Custom model ID input */}
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        value={quickModel}
                        onChange={e => setQuickModel(e.target.value)}
                        placeholder="Or type a custom model ID…"
                        className="flex-1 px-2 py-1.5 rounded text-xs font-mono text-slate-300 bg-transparent outline-none"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                    </div>
                  </div>

                  {/* API key input */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-500">API Key <span className="text-slate-600">(stored in Supabase, RLS-protected)</span></label>
                    <input
                      type="password"
                      value={quickKey}
                      onChange={e => setQuickKey(e.target.value)}
                      placeholder={quickPreset.keyHint}
                      className="w-full px-3 py-2 rounded text-sm font-mono text-slate-200 bg-transparent outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${quickKey ? quickPreset.color + '44' : 'rgba(255,255,255,0.1)'}` }}
                    />
                  </div>

                  {quickError && (
                    <div className="flex items-center gap-2 text-xs text-red-400 p-2 rounded" style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
                      <AlertCircle size={11} /> {quickError}
                    </div>
                  )}

                  <button
                    onClick={handleQuickSetup}
                    disabled={quickSaving || quickSuccess || !quickKey.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-all disabled:opacity-50"
                    style={{ background: quickSuccess ? '#10B981' : quickPreset.color, color: '#fff' }}
                  >
                    {quickSaving ? <Loader2 size={14} className="animate-spin" /> : quickSuccess ? <CheckCircle2 size={14} /> : <Zap size={14} />}
                    {quickSaving ? 'Registering…' : quickSuccess ? 'Provider Registered!' : `Register ${quickPreset.label} Provider`}
                  </button>
                </>
              )}
            </div>
          )}

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
