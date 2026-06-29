/* =============================================================
   ORCHESTRA FRAMEWORK DASHBOARD — Main Dashboard Page
   Design: Cyberpunk Terminal / Sci-Fi Operations Center
   - Fixed left sidebar (240px) with nav sections
   - Top header bar with live clock + connection status
   - 4-column stat cards → datasets table → hardware + conductors
   ============================================================= */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useOrchestra } from '@/hooks/useOrchestra';
import { Dataset, HardwareProfile, LlmProvider } from '@/lib/supabase';
import { getProviderKey } from '@/lib/providerSecrets';
import DatasetReviewPanel from '@/components/DatasetReviewPanel';
import CreateDatasetPanel from '@/components/createDataset/CreateDatasetPanel';
import GenerateDatasetPanel from '@/components/GenerateDatasetPanel';
import EditDatasetPanel from '@/components/EditDatasetPanel';
import LlmProviderManager from '@/components/LlmProviderManager';
import LlmMetricsPanel from '@/components/LlmMetricsPanel';
import { generationStore } from '@/lib/generationStore';
import {
  Database, Cpu, Bot, RefreshCw, Activity, CheckCircle2,
  AlertCircle, BarChart3, FileCode2, Shield, Server, Zap, Loader2,
  ChevronRight, GitBranch, Eye, Download, Plus, Play, Edit2, Copy, Settings2, Clock, Layers, BookOpen, ChevronDown, ChevronUp
} from 'lucide-react';

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663252637644/H5L46992Uxp4RipEv5JscA/orchestra-hero-bg-JrMSgx5cYrB7Hr8w7yiaVr.webp';
const SIDEBAR_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663252637644/H5L46992Uxp4RipEv5JscA/orchestra-sidebar-glow-BgftYdjdGVMVxco7tvCJqN.webp';

// ─── Animated Counter ──────────────────────────────────────────
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString()}</>;
}

// ─── Live Clock ────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="metric-value text-slate-400 text-xs">
      {time.toLocaleTimeString('en-US', { hour12: false })} UTC
    </span>
  );
}

// ─── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls = status === 'active' ? 'badge-active'
    : status === 'draft' ? 'badge-draft'
    : status === 'generating' ? 'badge-generating'
    : 'badge-retired';
  return <span className={cls}>{status}</span>;
}

// ─── Stat Card ─────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, color, delay
}: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; color: string; delay: number;
}) {
  const colorMap: Record<string, string> = {
    cyan: '#06B6D4', violet: '#7C3AED', emerald: '#10B981', amber: '#F59E0B'
  };
  const hex = colorMap[color] || '#06B6D4';
  return (
    <div
      className="glass-card rounded-lg p-5 card-enter"
      style={{ animationDelay: `${delay}ms`, border: `1px solid ${hex}22` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center"
          style={{ background: `${hex}18`, border: `1px solid ${hex}33` }}
        >
          <Icon size={18} style={{ color: hex }} />
        </div>
        <div className="w-2 h-2 rounded-full led-pulse" style={{ color: hex, background: hex }} />
      </div>
      <div className="metric-value text-3xl font-bold text-slate-100 mb-1">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-1 metric-value">{sub}</div>}
    </div>
  );
}

// ─── Dataset Row ───────────────────────────────────────────────
function DatasetRow({ ds, index, onReview, onGenerate, onEdit, onClone }: { ds: Dataset; index: number; onReview: (ds: Dataset) => void; onGenerate: (ds: Dataset) => void; onEdit: (ds: Dataset) => void; onClone: (ds: Dataset) => void }) {
  const [expanded, setExpanded] = useState(false);
  const taskIcon = ds.task_type === 'sql_correction' ? FileCode2 : Shield;
  const TaskIcon = taskIcon;

  // Subscribe to generation store to know if THIS dataset is currently generating
  const genState = useSyncExternalStore(
    generationStore.subscribe.bind(generationStore),
    generationStore.getState.bind(generationStore),
  );
  const isThisGenerating = genState.stage === 'running' && genState.datasetId === ds.id;
  const isThisDone = genState.stage === 'done' && genState.datasetId === ds.id;
  const otherGenerating = genState.stage === 'running' && genState.datasetId !== ds.id;

  const downloadAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase
      .from('dataset_samples')
      .select('split,index,system_prompt,user_prompt,assistant_response')
      .eq('dataset_id', ds.id)
      .order('split').order('index');
    if (!data) return;
    const jsonl = data.map(s => JSON.stringify({ system: s.system_prompt, user: s.user_prompt, assistant: s.assistant_response })).join('\n');
    const blob = new Blob([jsonl], { type: 'application/jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${ds.name}_all.jsonl`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer card-enter"
        style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <TaskIcon size={14} className="text-slate-500 shrink-0" />
            <span className="metric-value text-sm text-slate-200">{ds.name}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="metric-value text-xs text-slate-400">{ds.version}</span>
        </td>
        <td className="py-3 px-4">
          <span className="text-xs text-slate-400">{ds.task_type.replace('_', ' ')}</span>
        </td>
        <td className="py-3 px-4">
          <span className="metric-value text-xs" style={{ color: '#06B6D4' }}>{ds.metric_type}</span>
        </td>
        <td className="py-3 px-4">
          <div className="flex flex-col">
            <span className="metric-value text-sm text-slate-200">{ds.num_train.toLocaleString()}</span>
            <span className="metric-value text-xs text-slate-500">{ds.num_eval} eval</span>
          </div>
        </td>
        <td className="py-3 px-4"><StatusBadge status={ds.status} /></td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {(ds.status === 'draft' || ds.status === 'generating') && (
              <button
                onClick={(e) => { e.stopPropagation(); onGenerate(ds); }}
                disabled={otherGenerating}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isThisGenerating ? 'rgba(6,182,212,0.1)' : isThisDone ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${isThisGenerating ? 'rgba(6,182,212,0.35)' : isThisDone ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.3)'}`,
                  color: isThisGenerating ? '#06B6D4' : '#10B981',
                }}
                title={isThisGenerating ? 'View running generation' : otherGenerating ? `${genState.datasetName} is generating — wait for it to complete` : 'Generate dataset samples'}
              >
                {isThisGenerating
                  ? <><Loader2 size={11} className="animate-spin" /> View Progress</>  
                  : <><Play size={11} /> Generate</>}
              </button>
            )}
            {ds.status === 'draft' && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(ds); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}
                title="Edit dataset (DRAFT only)"
              >
                <Edit2 size={11} /> Edit
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onReview(ds); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
              style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)', color: '#06B6D4' }}
              title="Review samples"
            >
              <Eye size={11} /> Review
            </button>
            <button
              onClick={downloadAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}
              title="Download all as JSONL"
            >
              <Download size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClone(ds); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}
              title="Clone to new draft"
            >
              <Copy size={11} />
            </button>
            <ChevronRight
              size={14}
              className="text-slate-600 transition-transform"
              style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
            />
          </div>
        </td>
      </tr>
      {expanded && (() => {
        const cfg = ds.generation_config as Record<string, unknown> | null;
        const categories = (cfg?.categories as { label: string; count: number; color?: string }[] | undefined) || [];
        const totalConfigured = categories.reduce((s, c) => s + c.count, 0);
        const trainSplit = cfg?.train_split as number | undefined;
        const evalSplit = cfg?.eval_split as number | undefined;
        const modelHint = cfg?.model_hint as string | undefined;
        const hasNoSamples = ds.num_train === 0 && ds.num_eval === 0;
        return (
          <tr className="border-b border-white/5 bg-white/[0.015]">
            <td colSpan={7} className="px-4 py-4">
              <div className="grid grid-cols-3 gap-5 text-xs">
                {/* Col 1: Description + meta */}
                <div className="space-y-3">
                  <div>
                    <div className="text-slate-500 mb-1 uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>Description</div>
                    <div className="text-slate-300 leading-relaxed">{ds.description || '—'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-slate-500 mb-0.5 uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>Created</div>
                      <div className="metric-value text-slate-400">{new Date(ds.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-0.5 uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>Updated</div>
                      <div className="metric-value text-slate-400">{new Date(ds.updated_at).toLocaleString()}</div>
                    </div>
                  </div>
                  {modelHint && (
                    <div>
                      <div className="text-slate-500 mb-0.5 uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>Model Hint</div>
                      <div className="metric-value text-slate-300">{modelHint}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-slate-500 mb-0.5 uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>File Paths</div>
                    <div className="metric-value text-slate-500 truncate text-[10px]">{ds.train_path}</div>
                    <div className="metric-value text-slate-500 truncate text-[10px]">{ds.eval_path}</div>
                  </div>
                </div>

                {/* Col 2: Category composition */}
                <div>
                  <div className="text-slate-500 mb-2 uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>Dataset Composition</div>
                  {categories.length > 0 ? (
                    <div className="space-y-2">
                      {categories.map((cat, ci) => {
                        const pct = totalConfigured > 0 ? (cat.count / totalConfigured) * 100 : 0;
                        return (
                          <div key={ci}>
                            <div className="flex justify-between mb-0.5">
                              <span className="text-slate-300">{cat.label}</span>
                              <span className="metric-value" style={{ color: cat.color || '#06B6D4' }}>{cat.count} samples</span>
                            </div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color || '#06B6D4', transition: 'width 0.5s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-1 border-t border-white/5 flex gap-3 text-slate-500">
                        <span>Total configured: <span className="metric-value text-slate-300">{totalConfigured}</span></span>
                        {trainSplit && <span>Train split: <span className="metric-value text-slate-300">{Math.round(trainSplit * 100)}%</span></span>}
                        {evalSplit && <span>Eval split: <span className="metric-value text-slate-300">{Math.round(evalSplit * 100)}%</span></span>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 italic">No composition configured</div>
                  )}
                </div>

                {/* Col 3: Sample status + actions */}
                <div>
                  <div className="text-slate-500 mb-2 uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>Sample Status</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Train samples</span>
                      <span className="metric-value" style={{ color: ds.num_train > 0 ? '#10B981' : '#F43F5E' }}>{ds.num_train.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Eval samples</span>
                      <span className="metric-value" style={{ color: ds.num_eval > 0 ? '#10B981' : '#F43F5E' }}>{ds.num_eval.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status</span>
                      <span className="metric-value" style={{ color: ds.status === 'active' ? '#10B981' : ds.status === 'draft' ? '#F59E0B' : '#06B6D4' }}>{ds.status.toUpperCase()}</span>
                    </div>
                  </div>
                  {hasNoSamples && (
                    <div className="mt-3 p-2 rounded" style={{ background: isThisGenerating ? 'rgba(6,182,212,0.07)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isThisGenerating ? 'rgba(6,182,212,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                      <div className="text-[10px] mb-2" style={{ color: isThisGenerating ? '#06B6D4' : '#F59E0B' }}>
                        {isThisGenerating ? `⚡ Generating… ${genState.completedSamples}/${genState.totalSamples} samples` : '⚠ No samples generated — dataset needs to be populated'}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onGenerate(ds); }}
                        disabled={otherGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs w-full justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: isThisGenerating ? 'rgba(6,182,212,0.12)' : 'rgba(16,185,129,0.12)',
                          border: `1px solid ${isThisGenerating ? 'rgba(6,182,212,0.35)' : 'rgba(16,185,129,0.35)'}`,
                          color: isThisGenerating ? '#06B6D4' : '#10B981',
                        }}
                      >
                        {isThisGenerating
                          ? <><Loader2 size={11} className="animate-spin" /> View Progress</>
                          : <><Play size={11} /> Generate Samples</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        );
      })()}
    </>
  );
}

// ─── Hardware Card ─────────────────────────────────────────────
function HardwareCard({ hw, index }: { hw: HardwareProfile; index: number }) {
  const isGpu = hw.vram_gb > 0 && hw.gpu_model && hw.gpu_model !== 'none';
  const accentColor = isGpu ? '#06B6D4' : '#7C3AED';
  return (
    <div
      className="glass-card rounded-lg p-4 card-enter"
      style={{ animationDelay: `${index * 80}ms`, borderColor: `${accentColor}22` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}
        >
          <Server size={15} style={{ color: accentColor }} />
        </div>
        <div className="flex gap-1">
          {hw.docker && (
            <span className="text-xs px-1.5 py-0.5 rounded metric-value"
              style={{ background: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)', fontSize: '0.6rem' }}>
              DOCKER
            </span>
          )}
          {hw.lmstudio && (
            <span className="text-xs px-1.5 py-0.5 rounded metric-value"
              style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)', fontSize: '0.6rem' }}>
              LMSTUDIO
            </span>
          )}
        </div>
      </div>
      <div className="font-semibold text-slate-200 text-sm mb-0.5" style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
        {hw.name.replace(/_/g, ' ').toUpperCase()}
      </div>
      <div className="text-xs text-slate-400 mb-3">{hw.machine_name}</div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">GPU</span>
          <span className="metric-value text-slate-300">{hw.gpu_model}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">VRAM</span>
          <span className="metric-value" style={{ color: accentColor }}>{hw.vram_gb} GB</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">RAM</span>
          <span className="metric-value text-slate-300">{hw.ram_gb} GB</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">OS</span>
          <span className="metric-value text-slate-400 truncate max-w-[120px]">{hw.os}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Provider as Conductor Card ────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  openrouter: '#7C3AED',
  anthropic: '#D97706',
  openai: '#10B981',
  gemini: '#3B82F6',
  venice: '#EC4899',
  lmstudio_local: '#06B6D4',
  lmstudio_network: '#06B6D4',
  custom: '#64748B',
};
const PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  venice: 'Venice.ai',
  lmstudio_local: 'LMStudio (local)',
  lmstudio_network: 'LMStudio (network)',
  custom: 'Custom',
};

function ConductorCard({ c, index }: { c: LlmProvider; index: number }) {
  const color = PROVIDER_COLORS[c.provider_type] || '#64748B';
  const localKey = !!getProviderKey(c.id);
  const hasKey = localKey || !!c.api_key || !!c.api_key_hint;
  return (
    <div
      className="glass-card rounded-lg p-4 card-enter"
      style={{ animationDelay: `${index * 80}ms`, borderColor: `${color}22` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}33` }}
        >
          <Bot size={15} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-medium text-slate-200 truncate" style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              {c.display_name || c.name}
            </div>
            {c.is_default && (
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: 'monospace' }}>DEFAULT</span>
            )}
          </div>
          <div className="text-xs text-slate-500">{PROVIDER_LABELS[c.provider_type] || c.provider_type}</div>
        </div>
        <div className="flex items-center gap-1">
          {c.is_active ? (
            <span className="badge-active" style={{ fontSize: '9px' }}>ACTIVE</span>
          ) : (
            <span className="badge-draft" style={{ fontSize: '9px', color: '#64748B', borderColor: 'rgba(100,116,139,0.4)', background: 'rgba(100,116,139,0.1)' }}>INACTIVE</span>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Model</span>
          <span className="metric-value text-slate-300 truncate max-w-[160px]" title={c.model_id}>{c.model_id}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Max Tokens</span>
          <span className="metric-value" style={{ color }}>{c.max_tokens?.toLocaleString() || '—'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Temperature</span>
          <span className="metric-value text-slate-300">{c.temperature ?? '—'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">API Key</span>
          <span className="metric-value" style={{ color: hasKey ? '#10B981' : '#EF4444' }}>
            {localKey ? 'Stored locally ✓' : hasKey ? 'Hint only' : 'Not set'}
          </span>
        </div>
        {c.capabilities && c.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {c.capabilities.map(cap => (
              <span key={cap} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace' }}>{cap}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'datasets', label: 'Datasets', icon: Database },
  { id: 'hardware', label: 'Hardware', icon: Cpu },
  { id: 'conductors', label: 'Conductors', icon: Bot },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'docs', label: 'Docs', icon: BookOpen },
];

function Sidebar({ active, onNav }: { active: string; onNav: (id: string) => void }) {
  return (
    <aside
      className="fixed left-0 top-0 h-full w-[220px] z-20 flex flex-col"
      style={{
        background: 'rgba(7, 11, 20, 0.95)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backgroundImage: `url(${SIDEBAR_BG})`,
        backgroundSize: 'cover',
        backgroundPosition: 'left center',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.4)' }}>
            <Layers size={14} style={{ color: '#06B6D4' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.65rem', fontWeight: 700, color: '#06B6D4', letterSpacing: '0.12em' }}>
              ORCHESTRA
            </div>
            <div className="text-slate-600" style={{ fontSize: '0.55rem', letterSpacing: '0.08em' }}>
              FRAMEWORK v1.0
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left text-sm transition-all nav-item ${active === id ? 'nav-active' : 'text-slate-500'}`}
          >
            <Icon size={15} />
            <span style={{ fontFamily: active === id ? 'inherit' : 'inherit', letterSpacing: '0.02em' }}>
              {label}
            </span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="text-slate-600 text-xs metric-value">Composer Phase</div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-1.5 h-1.5 rounded-full led-pulse" style={{ background: '#10B981', color: '#10B981' }} />
          <span className="text-xs" style={{ color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>OPERATIONAL</span>
        </div>
      </div>
    </aside>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────
export default function Dashboard() {
  const { datasets, hardware, conductors, llmProviders, loading, error, lastRefresh, refresh } = useOrchestra();
  const [activeSection, setActiveSection] = useState('overview');
  const [docsExpanded, setDocsExpanded] = useState<Record<string, boolean>>({ readme: true, quickstart: false, architecture: false });
  const [reviewDataset, setReviewDataset] = useState<Dataset | null>(null);
  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [generateDataset, setGenerateDataset] = useState<Dataset | null>(null);
  const [editDataset, setEditDataset] = useState<Dataset | null>(null);
  const [showProviderManager, setShowProviderManager] = useState(false);

  // Subscribe to background generation store for the status indicator
  const genState = useSyncExternalStore(
    generationStore.subscribe.bind(generationStore),
    generationStore.getState.bind(generationStore),
  );
  const bgRunning = genState.stage === 'running';
  const bgDone = genState.stage === 'done';

  const handleCloneDataset = async (ds: Dataset) => {
    const { supabase } = await import('@/lib/supabase');
    // Use a unique timestamp suffix to avoid race conditions with concurrent clones
    const copyName = `${ds.name}-copy-${Date.now()}`;
    const clone = {
      name: copyName,
      version: ds.version,
      description: ds.description ? `${ds.description} (clone of ${ds.name})` : `Clone of ${ds.name}`,
      status: 'draft',
      task_type: ds.task_type,
      metric_type: ds.metric_type,
      num_train: ds.num_train,
      num_eval: ds.num_eval,
      train_path: `./datasets/${copyName}/train.jsonl`,
      eval_path: `./datasets/${copyName}/eval.jsonl`,
      format: ds.format || 'jsonl',
      generation_config: ds.generation_config || {},
    };
    const { error } = await supabase.from('datasets').insert(clone);
    if (error) {
      const { toast } = await import('sonner');
      toast.error(`Clone failed: ${error.message}`);
      return;
    }
    refresh();
  };
  const totalSamples = datasets.reduce((s, d) => s + d.num_train + d.num_eval, 0);
  const activeDatasets = datasets.filter(d => d.status === 'active').length;

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen" style={{ background: '#070B14' }}>
      {reviewDataset && (
        <DatasetReviewPanel dataset={reviewDataset} onClose={() => setReviewDataset(null)} />
      )}
      {showCreateDataset && (
        <CreateDatasetPanel
          onClose={() => setShowCreateDataset(false)}
          onCreated={() => { setShowCreateDataset(false); refresh(); }}
        />
      )}
      {generateDataset && (
        <GenerateDatasetPanel
          dataset={generateDataset}
          onClose={() => setGenerateDataset(null)}
          onGenerated={() => { refresh(); }}
        />
      )}
      {editDataset && (
        <EditDatasetPanel
          dataset={editDataset}
          onClose={() => setEditDataset(null)}
          onSaved={() => { setEditDataset(null); refresh(); }}
        />
      )}
      {showProviderManager && (
        <LlmProviderManager
          providers={llmProviders}
          onClose={() => setShowProviderManager(false)}
          onRefresh={refresh}
        />
      )}
      <Sidebar active={activeSection} onNav={scrollTo} />

      {/* Main content */}
      <div className="ml-[220px] flex flex-col min-h-screen">

        {/* Header */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-3"
          style={{
            background: 'rgba(7, 11, 20, 0.92)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3">
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.1em' }}>
              COMPOSER DASHBOARD
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <GitBranch size={12} className="text-slate-600" />
              <span className="text-xs text-slate-500 metric-value">orchestra-framework</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LiveClock />
            {lastRefresh && (
              <span className="text-xs text-slate-600 metric-value">
                Refreshed {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            {/* Background generation status indicator */}
            {(bgRunning || bgDone) && (
              <button
                onClick={() => {
                  // Re-open the panel for the dataset that's running/done
                  const ds = datasets.find(d => d.id === genState.datasetId);
                  if (ds) setGenerateDataset(ds);
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
                style={{
                  background: bgDone ? 'rgba(16,185,129,0.08)' : 'rgba(6,182,212,0.08)',
                  border: `1px solid ${bgDone ? 'rgba(16,185,129,0.3)' : 'rgba(6,182,212,0.3)'}`,
                  color: bgDone ? '#10B981' : '#06B6D4',
                }}
                title={bgRunning ? `Generating ${genState.datasetName} — click to view` : `${genState.datasetName} complete — click to view`}
              >
                {bgRunning
                  ? <><Loader2 size={11} className="animate-spin" /> {genState.completedSamples}/{genState.totalSamples} samples</>
                  : <><CheckCircle2 size={11} /> {genState.datasetName} done</>}
              </button>
            )}
            <button
              onClick={() => setShowProviderManager(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', color: '#7C3AED' }}
              title="Manage LLM Providers"
            >
              <Settings2 size={12} />
              {llmProviders.filter(p => p.is_active).length} Provider{llmProviders.filter(p => p.is_active).length !== 1 ? 's' : ''}
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
              style={{
                background: 'rgba(6,182,212,0.08)',
                border: '1px solid rgba(6,182,212,0.25)',
                color: '#06B6D4',
              }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <div className="flex items-center gap-1.5">
              {error ? (
                <><AlertCircle size={12} style={{ color: '#F43F5E' }} /><span className="text-xs" style={{ color: '#F43F5E' }}>Error</span></>
              ) : (
                <><CheckCircle2 size={12} style={{ color: '#10B981' }} /><span className="text-xs" style={{ color: '#10B981' }}>Connected</span></>
              )}
            </div>
          </div>
        </header>

        {/* Hero Banner */}
        <div
          className="relative overflow-hidden"
          style={{ height: '220px', backgroundImage: `url(${HERO_BG})`, backgroundSize: 'cover', backgroundPosition: 'center 45%' }}
        >
          {/* Dark gradient overlay — heavier on left for text legibility, fades to reveal art on right */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(5,10,20,0.92) 0%, rgba(5,10,20,0.65) 40%, rgba(5,10,20,0.25) 70%, rgba(5,10,20,0.5) 100%)' }} />
          {/* Bottom fade to blend into content */}
          <div className="absolute bottom-0 left-0 right-0" style={{ height: '60px', background: 'linear-gradient(to bottom, transparent, rgba(7,11,20,0.95))' }} />
          <div className="relative z-10 flex flex-col justify-center h-full px-8">
            <div className="text-xs metric-value mb-1 tracking-widest" style={{ color: '#06B6D4', opacity: 0.8 }}>ORCHESTRA FRAMEWORK</div>
            <h1 style={{ fontFamily: 'Orbitron, monospace', fontSize: '1.75rem', fontWeight: 900, color: '#fff', letterSpacing: '0.06em', lineHeight: 1.2 }}>
              COMPOSER <span style={{ color: '#06B6D4' }}>OPERATIONAL</span>
            </h1>
            <p className="text-sm mt-2" style={{ color: 'rgba(148,163,184,0.85)', maxWidth: '480px' }}>
              Dataset registry live · Supabase connected · Ready for Conductor
            </p>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 px-6 py-6 space-y-8">

          {/* Error banner */}
          {error && (
            <div className="rounded-lg p-4 flex items-center gap-3"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)' }}>
              <AlertCircle size={16} style={{ color: '#F43F5E' }} />
              <span className="text-sm text-slate-300">{error}</span>
            </div>
          )}

          {/* ── Overview Stats ── */}
          <section id="section-overview">
            <h2 className="section-header text-sm">System Overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Database} label="Total Datasets" value={datasets.length} sub={`${activeDatasets} active`} color="cyan" delay={0} />
              <StatCard icon={Zap} label="Total Samples" value={totalSamples} sub="train + eval" color="violet" delay={80} />
              <StatCard icon={Cpu} label="Hardware Nodes" value={hardware.length} sub="registered" color="emerald" delay={160} />
              <StatCard icon={Bot} label="Conductors" value={conductors.length} sub="configured" color="amber" delay={240} />
            </div>
          </section>

          {/* ── Datasets ── */}
          <section id="section-datasets">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-header text-sm" style={{ marginBottom: 0 }}>Dataset Registry</h2>
              <button
                onClick={() => setShowCreateDataset(true)}
                className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium transition-all"
                style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.35)', color: '#06B6D4' }}
              >
                <Plus size={13} /> New Dataset
              </button>
            </div>
            {loading ? (
              <div className="glass-card rounded-lg p-8 text-center text-slate-500 text-sm">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2" style={{ color: '#06B6D4' }} />
                Loading datasets from Supabase...
              </div>
            ) : datasets.length === 0 ? (
              <div className="glass-card rounded-lg p-8 text-center text-slate-500 text-sm">No datasets registered yet.</div>
            ) : (
              <div className="glass-card rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Name', 'Version', 'Task Type', 'Metric', 'Samples', 'Status', ''].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider metric-value">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map((ds, i) => <DatasetRow key={ds.id} ds={ds} index={i} onReview={setReviewDataset} onGenerate={setGenerateDataset} onEdit={setEditDataset} onClone={handleCloneDataset} />)}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── LLM Usage Metrics ── */}
          <section id="section-metrics">
            <h2 className="section-header text-sm">LLM Usage Metrics</h2>
            <LlmMetricsPanel providers={llmProviders} />
          </section>

          {/* ── Hardware ── */}
          <section id="section-hardware">
            <h2 className="section-header text-sm">Hardware Profiles</h2>
            {loading ? (
              <div className="text-slate-500 text-sm">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hardware.map((hw, i) => <HardwareCard key={hw.id} hw={hw} index={i} />)}
              </div>
            )}
          </section>

          {/* ── Conductors ── */}
          <section id="section-conductors">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-header text-sm" style={{ marginBottom: 0 }}>LLM Providers (Conductors)</h2>
              <span className="text-xs text-slate-500">Managed via LLM Provider Manager</span>
            </div>
            {loading ? (
              <div className="text-slate-500 text-sm">Loading...</div>
            ) : llmProviders.filter(p => p.is_active).length === 0 ? (
              <div className="glass-card rounded-lg p-6 text-center">
                <Bot size={24} className="mx-auto mb-2 text-slate-600" />
                <div className="text-sm text-slate-400">No active providers configured.</div>
                <div className="text-xs text-slate-500 mt-1">Use the LLM Provider Manager to add providers.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                {llmProviders.filter(p => p.is_active).map((c, i) => <ConductorCard key={c.id} c={c} index={i} />)}
              </div>
            )}
          </section>

          {/* ── Phase Roadmap ── */}
          <section>
            <h2 className="section-header text-sm">Deployment Roadmap</h2>
            <div className="glass-card rounded-lg p-5">
              <div className="space-y-3">
                {[
                  { phase: '01', label: 'Supabase Provisioning', status: 'done', desc: 'Schema applied, hardware + conductor profiles seeded' },
                  { phase: '02', label: 'Composer SDK & CLI', status: 'done', desc: 'Dataset lifecycle tools: define, generate, validate, register, retire' },
                  { phase: '03', label: 'SQL Correction Dataset', status: 'done', desc: '200 samples · 170 train / 30 eval · 100% valid · Registered' },
                  { phase: '04', label: 'MITRE TTP/OWASP Dataset', status: 'done', desc: '200 samples · 65 unique TTPs · 14 tactics · 100% valid · Registered' },
                  { phase: '05', label: 'Conductor Agent', status: 'next', desc: 'Qwen-driven orchestrator with Python tool SDK + autoresearch loop' },
                  { phase: '06', label: 'Musician Workers', status: 'pending', desc: 'Dockerized training workers with DDP multi-GPU support' },
                  { phase: '07', label: 'HITL Console', status: 'pending', desc: 'Streamlit live dashboard with Pause / Stop / Inject controls' },
                  { phase: '08', label: 'Production Hardening', status: 'pending', desc: 'Docker Compose, secrets management, monitoring' },
                ].map(({ phase, label, status, desc }) => (
                  <div key={phase} className="flex items-start gap-4 py-2 border-b border-white/5 last:border-0">
                    <div
                      className="metric-value text-xs w-8 shrink-0 mt-0.5"
                      style={{ color: status === 'done' ? '#10B981' : status === 'next' ? '#06B6D4' : '#475569' }}
                    >
                      {phase}
                    </div>
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: status === 'done' ? '#10B981' : status === 'next' ? '#06B6D4' : '#1E293B',
                        border: status === 'pending' ? '1px solid #334155' : 'none',
                        ...(status === 'next' ? { boxShadow: '0 0 8px rgba(6,182,212,0.6)' } : {})
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200 font-medium">{label}</span>
                        {status === 'done' && <span className="badge-active">DONE</span>}
                        {status === 'next' && <span className="badge-draft" style={{ color: '#06B6D4', borderColor: 'rgba(6,182,212,0.4)', background: 'rgba(6,182,212,0.1)' }}>NEXT</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {status === 'done' && <CheckCircle2 size={14} style={{ color: '#10B981' }} />}
                      {status === 'next' && <Clock size={14} style={{ color: '#06B6D4' }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Docs ── */}
          <section id="section-docs">
            <h2 className="section-header text-sm">Documentation</h2>
            <div className="space-y-3">
              {([
                {
                  id: 'readme',
                  title: 'README — Orchestra SDK',
                  color: '#06B6D4',
                  content: `# Orchestra SDK\n\n## Overview\nThe Orchestra SDK is a Python package that implements an autonomous LLM-driven research loop for fine-tuning local models. It orchestrates a Conductor agent that iteratively proposes, tests, and evaluates training hypotheses.\n\n## Architecture\n\`\`\`\nComposer Dashboard (this UI)\n    ↓ defines datasets, registers providers\nConductor (orchestra_sdk)\n    ↓ autonomous loop: propose → edit → commit → run → evaluate → keep/discard\nMusician (Docker/K8s container)\n    ↓ executes train.py, writes metrics to output/results.json\nModel artifacts → workspace/output/ → workspace/best/ (if new best)\n\`\`\`\n\n## Installation\n\`\`\`bash\npip install -e /path/to/orchestra_sdk\n\`\`\`\n\n## Quick Commands\n\`\`\`bash\norchestra init                          # scaffold conductor_config.yaml\norchestra migrate                       # apply Supabase DDL\norchestra dry-run conductor_config.yaml # validate config + connectivity\norchestra run conductor_config.yaml     # start autonomous loop\norchestra status conductor_config.yaml  # show session progress\n\`\`\`\n\n## Key Concepts\n- **Session**: a named research run with a target metric and max iterations\n- **Hypothesis**: an LLM-proposed edit to train.py with a rationale\n- **Keep/Discard**: if metric improves beyond threshold, the edit is committed; otherwise the workspace is reverted\n- **Best model**: whenever a KEEP iteration beats all previous bests, the model artifacts are copied to \`workspace/best/\`\n- **Memory**: semantic search over past iterations using pgvector, so the Conductor avoids repeating failed ideas`,
                },
                {
                  id: 'quickstart',
                  title: 'Quickstart Guide',
                  color: '#7C3AED',
                  content: `# Quickstart\n\n## Prerequisites\n- Python 3.10+\n- Docker (for Musician container)\n- Supabase project with \`orchestra migrate\` applied\n- An LLM provider API key (OpenRouter recommended)\n\n## Step 1 — Install\n\`\`\`bash\ngit clone https://github.com/your-org/orchestra_sdk\ncd orchestra_sdk\npip install -e .\n\`\`\`\n\n## Step 2 — Initialize workspace\n\`\`\`bash\nmkdir -p ~/.orchestra/sessions/memory_scribe_v1\ncd ~/.orchestra/sessions/memory_scribe_v1\norchestra init\n\`\`\`\nThis creates \`conductor_config.yaml\`, \`program.md\`, and \`train.py\`.\n\n## Step 3 — Configure\nEdit \`conductor_config.yaml\`:\n\`\`\`yaml\nsession:\n  name: memory_scribe_v1\n  max_iterations: 20\n  target_metric: eval_loss\n  keep_threshold: -0.005\nllm:\n  provider: openrouter\n  model: qwen/qwen3.5-plus-02-15\n  api_key_env: OPENROUTER_API_KEY\nrunner:\n  type: docker\n  image: orchestra-musician:latest\n\`\`\`\n\n## Step 4 — Apply migrations\n\`\`\`bash\nexport SUPABASE_URL=https://your-project.supabase.co\nexport SUPABASE_SERVICE_KEY=your-service-key\norchestra migrate\n\`\`\`\n\n## Step 5 — Dry run\n\`\`\`bash\nexport OPENROUTER_API_KEY=sk-or-...\norchestra dry-run conductor_config.yaml\n\`\`\`\nExpected output: \`✓ Config valid · ✓ LLM reachable · ✓ Supabase connected · ✓ Git initialized\`\n\n## Step 6 — Run\n\`\`\`bash\norchestra run conductor_config.yaml\n\`\`\`\nThe Conductor will begin iterating. Watch for:\n- \`[KEEP]\` — improvement accepted, baseline updated\n- \`NEW BEST\` — model saved to \`workspace/best/\`\n- \`[DISCARD]\` — no improvement, workspace reverted`,
                },
                {
                  id: 'architecture',
                  title: 'Architecture & Container Deployment',
                  color: '#10B981',
                  content: `# Architecture & Container Deployment\n\n## Workspace Layout\n\`\`\`\n~/.orchestra/sessions/{session_name}/\n├── program.md          # task description for the Conductor\n├── train.py            # the training script being evolved\n├── conductor_config.yaml\n├── output/             # Musician writes artifacts here\n│   ├── results.json    # {metric: float, log: str}\n│   └── model/          # saved model weights\n├── best/               # copy of output/ from best iteration\n│   ├── best_manifest.json\n│   └── model/\n└── .orchestra_fallback/ # local Supabase fallback if offline\n\`\`\`\n\n## Docker Compose (single machine)\n\`\`\`bash\ncd orchestra_sdk/docker\ncp .env.example .env && nano .env  # fill in API keys\ndocker compose up -d\n\`\`\`\nServices: \`conductor\` (runs the loop), \`ollama\` (local LLM), \`pgvector\` (memory).\n\n## K3s Cluster (multi-machine)\n\`\`\`bash\nkubectl apply -f k8s/namespace.yaml\nkubectl apply -f k8s/pvcs.yaml\nkubectl create secret generic orchestra-secrets --from-env-file=.env -n orchestra\nkubectl apply -f k8s/ollama-deployment.yaml\n# Conductor launches Musician Jobs dynamically via K8sRunner\n\`\`\`\n\n## GPU Support\n- NVIDIA: \`nvidia-container-toolkit\` + \`nvidia.com/gpu: 1\` in Job spec\n- AMD ROCm: \`amd.com/gpu: 1\` + \`--device /dev/kfd\`\n\n## Shared Mounts\nThe Musician container mounts the same workspace volume as the Conductor:\n\`\`\`yaml\nvolumeMounts:\n  - name: orchestra-workspace\n    mountPath: /workspace\n\`\`\`\nOn bare metal, this is just \`~/.orchestra/sessions/{name}/\` — no containers needed for testing.`,
                },
              ] as { id: string; title: string; color: string; content: string }[]).map(doc => (
                <div key={doc.id} className="glass-card rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-3 text-left"
                    style={{ borderBottom: docsExpanded[doc.id] ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                    onClick={() => setDocsExpanded(prev => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen size={13} style={{ color: doc.color }} />
                      <span className="text-sm font-medium" style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.7rem', letterSpacing: '0.05em', color: doc.color }}>
                        {doc.title.toUpperCase()}
                      </span>
                    </div>
                    {docsExpanded[doc.id]
                      ? <ChevronUp size={14} className="text-slate-500" />
                      : <ChevronDown size={14} className="text-slate-500" />}
                  </button>
                  {docsExpanded[doc.id] && (
                    <div className="px-5 py-4">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>
                        {doc.content}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="pt-4 pb-8 border-t border-white/5 flex items-center justify-between text-xs text-slate-600">
            <span className="metric-value">Orchestra Framework · Composer v1.0.0</span>
            <span className="metric-value">Supabase project: domrhrldlufshogewfbp</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
