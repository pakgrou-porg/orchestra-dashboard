/* =============================================================
   GenerateDatasetPanel — Real LLM-powered dataset generation
   Design: Cyberpunk Terminal — glass cards, cyan/violet accents.

   Workflow:
   1. Shows dataset config summary (read-only)
   2. User selects provider + concurrency
   3. On "Generate" → calls real LLM generation engine via generationStore
   4. Shows live progress: phase steps + streaming log
   5. Panel can be CLOSED at any time without cancelling the job
   6. Re-opening the panel shows live progress if job is still running
   ============================================================= */
import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  X, Play, Loader2, CheckCircle2, AlertCircle,
  Terminal, Zap, Database, FileText,
  ChevronRight, Clock, RefreshCw, Server, StopCircle, Minimize2
} from 'lucide-react';
import { supabase, Dataset, LlmProvider } from '@/lib/supabase';
import { generationStore } from '@/lib/generationStore';

interface Props {
  dataset: Dataset;
  onClose: () => void;
  onGenerated: () => void;
}

const PHASE_ORDER = ['validate', 'scaffold', 'generate_train', 'generate_eval', 'validate_samples', 'register', 'done'] as const;
type PhaseId = typeof PHASE_ORDER[number];

const PHASE_META: Record<PhaseId, { label: string; icon: React.ElementType }> = {
  validate:         { label: 'Validate Configuration',      icon: CheckCircle2 },
  scaffold:         { label: 'Scaffold Output Directories', icon: Database },
  generate_train:   { label: 'Generate Train Split',        icon: Zap },
  generate_eval:    { label: 'Generate Eval Split',         icon: Zap },
  validate_samples: { label: 'Validate Samples',            icon: FileText },
  register:         { label: 'Register in Supabase',        icon: Database },
  done:             { label: 'Complete',                    icon: CheckCircle2 },
};

const CONCURRENCY_OPTIONS = [1, 2, 4, 8];

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  lmstudio_local: 'LMStudio (local)',
  lmstudio_network: 'LMStudio (network)',
  openrouter: 'OpenRouter',
  venice: 'Venice.ai',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  custom: 'Custom',
};

export default function GenerateDatasetPanel({ dataset, onClose, onGenerated }: Props) {
  const accentColor = '#06B6D4';

  // Subscribe to background generation store
  const genState = useSyncExternalStore(
    generationStore.subscribe.bind(generationStore),
    generationStore.getState.bind(generationStore),
  );

  // Determine if the store is running a job for THIS dataset
  const isThisDataset = genState.datasetId === dataset.id;
  const storeRunning = genState.stage === 'running' && isThisDataset;
  const storeDone    = genState.stage === 'done'    && isThisDataset;
  const storeError   = genState.stage === 'error'   && isThisDataset;

  // Local UI state (config stage only)
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [concurrency, setConcurrency] = useState(4);
  const [loadingProviders, setLoadingProviders] = useState(true);

  // If store is running/done/error for this dataset, skip config stage
  const showProgress = storeRunning || storeDone || storeError;

  // Compute totalSamples from generation_config.categories when num_train/num_eval are 0
  const _genCfg = (dataset.generation_config || {}) as Record<string, unknown>;
  const _cats = (_genCfg.categories as { count: number }[] | undefined) || [];
  const _catTotal = _cats.reduce((s, c) => s + (c.count || 0), 0);
  const _trainSplit = (_genCfg.train_split as number | undefined) ?? 0.8;
  const _computedTrain = _catTotal > 0 ? Math.round(_catTotal * _trainSplit) : 0;
  const _computedEval = _catTotal > 0 ? _catTotal - _computedTrain : 0;
  const totalSamples = (dataset.num_train || _computedTrain) + (dataset.num_eval || _computedEval);

  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [genState.logLines]);

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const handleStart = () => {
    const provider = providers.find(p => p.id === selectedProviderId);
    if (!provider) return;
    generationStore.start(dataset, provider, concurrency, totalSamples, onGenerated);
  };

  const handleAbort = () => {
    generationStore.abort();
  };

  const handleReset = () => {
    generationStore.reset();
  };

  // Load active providers from Supabase (prefer those with real api_key)
  useEffect(() => {
    supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .then(({ data }) => {
        const list = (data || []) as LlmProvider[];
        setProviders(list);
        const withKey = list.filter(p => p.api_key && p.api_key.length > 10);
        const preferred = withKey.find(p => p.is_default) || withKey[0] || list.find(p => p.is_default) || list[0];
        if (preferred) setSelectedProviderId(preferred.id);
        setLoadingProviders(false);
      });
  }, []);

  const selectedProvider = providers.find(p => p.id === selectedProviderId) || null;
  const generationConfig = (dataset.generation_config as Record<string, unknown>) || {};
  const categories = (generationConfig.categories as { label: string; count: number; color: string }[]) || [];
  const systemPrompt = (generationConfig.system_prompt as string) || (generationConfig.system_prompt_template as string) || '';
  const modelHint = (generationConfig.model_hint as string) || '';
  const hasKey = !!(selectedProvider?.api_key && selectedProvider.api_key.length > 10);
  const isLocalProvider = selectedProvider?.provider_type === 'lmstudio_local' || selectedProvider?.provider_type === 'lmstudio_network';
  const canGenerate = !!selectedProvider && (hasKey || isLocalProvider) && generationStore.canStart();

  const progressPct = showProgress ? genState.progressPct : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full max-w-2xl flex flex-col overflow-hidden"
        style={{
          background: '#0A0F1A',
          borderLeft: `1px solid ${accentColor}33`,
          boxShadow: `-24px 0 80px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${accentColor}22`, background: `${accentColor}07` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}
            >
              {storeRunning ? <Loader2 size={15} className="animate-spin" style={{ color: accentColor }} /> : <Play size={15} style={{ color: accentColor }} />}
            </div>
            <div>
              <div
                className="font-semibold text-slate-100"
                style={{ fontFamily: 'Orbitron, monospace', letterSpacing: '0.08em', fontSize: '0.7rem' }}
              >
                GENERATE DATASET
              </div>
              <div className="text-xs text-slate-500 font-mono">{dataset.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {storeRunning && (
              <button
                onClick={handleAbort}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
                style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', color: '#F43F5E' }}
                title="Cancel generation (in-flight requests will complete)"
              >
                <StopCircle size={12} /> Cancel
              </button>
            )}
            {storeRunning ? (
              /* Close WITHOUT cancelling — job continues in background */
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
                style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)', color: '#06B6D4' }}
                title="Close panel — generation continues in the background"
              >
                <Minimize2 size={12} /> Minimize
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Background-running banner (when store is running a DIFFERENT dataset) */}
        {genState.stage === 'running' && !isThisDataset && (
          <div
            className="px-6 py-2 flex items-center gap-2 text-xs shrink-0"
            style={{ background: 'rgba(245,158,11,0.07)', borderBottom: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}
          >
            <Loader2 size={11} className="animate-spin" />
            <span>
              <strong>{genState.datasetName}</strong> is generating in the background ({genState.completedSamples}/{genState.totalSamples} samples).
              You cannot start a new job until it completes.
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Dataset summary card */}
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-xs font-semibold text-slate-400" style={{ fontFamily: 'Orbitron, monospace', letterSpacing: '0.06em', fontSize: '0.65rem' }}>
              DATASET CONFIGURATION
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                ['Task Type', dataset.task_type],
                ['Metric', dataset.metric_type],
                ['Train Samples', String(dataset.num_train || _computedTrain)],
                ['Eval Samples', String(dataset.num_eval || _computedEval)],
                ['Format', dataset.format || 'jsonl'],
                ['Model Hint', modelHint || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{k}:</span>
                  <span className="text-xs font-mono" style={{ color: accentColor }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">Categories</div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(c => (
                    <span
                      key={c.label}
                      className="text-xs px-2 py-0.5 rounded font-mono"
                      style={{
                        background: `${c.color || accentColor}12`,
                        border: `1px solid ${c.color || accentColor}33`,
                        color: c.color || accentColor,
                      }}
                    >
                      {c.label} ({c.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* System prompt preview */}
            {systemPrompt && (
              <div>
                <div className="text-xs text-slate-500 mb-1">System Prompt</div>
                <div
                  className="text-xs text-slate-400 rounded p-2 font-mono leading-relaxed"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '80px', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)' }}
                >
                  {systemPrompt.slice(0, 300)}
                </div>
              </div>
            )}
          </div>

          {/* Config stage: provider + concurrency */}
          {!showProgress && (
            <div className="space-y-4">
              {/* Provider selector */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2" style={{ fontFamily: 'Orbitron, monospace', letterSpacing: '0.06em', fontSize: '0.65rem' }}>
                  LLM PROVIDER
                </div>
                {loadingProviders ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 size={12} className="animate-spin" /> Loading providers…
                  </div>
                ) : providers.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded text-xs" style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', color: '#F43F5E' }}>
                    <AlertCircle size={12} /> No active providers configured. Add one in the LLM Provider Manager.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {providers.map(p => {
                      const pHasKey = !!(p.api_key && p.api_key.length > 10);
                      const pIsLocal = p.provider_type === 'lmstudio_local' || p.provider_type === 'lmstudio_network';
                      const pReady = pHasKey || pIsLocal;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProviderId(p.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all"
                          style={{
                            background: selectedProviderId === p.id ? `${accentColor}10` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${selectedProviderId === p.id ? accentColor + '44' : 'rgba(255,255,255,0.07)'}`,
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-200 truncate">{p.display_name}</span>
                              {p.is_default && (
                                <span className="text-xs px-1 py-0.5 rounded" style={{ background: `${accentColor}15`, color: accentColor, fontSize: '0.6rem' }}>DEFAULT</span>
                              )}
                              {!pReady && (
                                <span className="text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontSize: '0.6rem' }}>NO KEY</span>
                              )}
                            </div>
                            <div className="text-xs font-mono mt-0.5" style={{ color: accentColor + 'aa', fontSize: '0.65rem' }}>
                              {p.model_id} · {PROVIDER_TYPE_LABELS[p.provider_type] || p.provider_type}
                            </div>
                          </div>
                          {selectedProviderId === p.id && (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: accentColor }}>
                              <div className="w-1.5 h-1.5 rounded-full bg-[#070B14]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedProvider && !canGenerate && generationStore.canStart() && (
                  <div className="mt-2 flex items-start gap-2 p-2.5 rounded text-xs" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
                    <AlertCircle size={11} className="mt-0.5 shrink-0" />
                    This provider has no API key stored. Edit it in the LLM Provider Manager to add the key before generating.
                  </div>
                )}
              </div>

              {/* Concurrency */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2" style={{ fontFamily: 'Orbitron, monospace', letterSpacing: '0.06em', fontSize: '0.65rem' }}>
                  CONCURRENCY
                </div>
                <div className="flex gap-2">
                  {CONCURRENCY_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setConcurrency(n)}
                      className="flex-1 py-2 rounded text-xs font-mono transition-all"
                      style={{
                        background: concurrency === n ? `${accentColor}15` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${concurrency === n ? accentColor + '44' : 'rgba(255,255,255,0.07)'}`,
                        color: concurrency === n ? accentColor : '#64748B',
                      }}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-600 mt-1.5">
                  Estimated time: ~{Math.ceil((totalSamples * 2.5) / concurrency)}s at {concurrency}× concurrency
                </div>
              </div>

              {/* Warning */}
              <div
                className="flex items-start gap-2 p-3 rounded"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-300/70">
                  This will generate <strong>{totalSamples} real samples</strong> by calling the LLM API and write them to Supabase.
                  The dataset status will change <span className="font-mono">DRAFT → ACTIVE</span> upon completion.
                  API credits will be consumed. Existing samples for this dataset will be replaced.
                </div>
              </div>
            </div>
          )}

          {/* Progress (running / done / error) */}
          {showProgress && (
            <div className="space-y-4">
              {/* Timer + status + progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {storeRunning && <Loader2 size={13} className="animate-spin" style={{ color: accentColor }} />}
                    {storeDone && <CheckCircle2 size={13} style={{ color: '#10B981' }} />}
                    {storeError && <AlertCircle size={13} className="text-red-400" />}
                    <span className="text-xs font-mono" style={{ color: storeDone ? '#10B981' : storeError ? '#F43F5E' : accentColor }}>
                      {storeRunning ? 'GENERATING…' : storeDone ? 'COMPLETE' : 'FAILED'}
                    </span>
                    {storeRunning && (
                      <span className="text-xs text-slate-500 font-mono">{genState.completedSamples}/{genState.totalSamples} samples</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                    <Clock size={11} /> {formatElapsed(genState.elapsedMs)}
                  </div>
                </div>

                {/* Progress bar */}
                {storeRunning && genState.totalSamples > 0 && (
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${accentColor}, #7C3AED)` }}
                    />
                  </div>
                )}
              </div>

              {/* Phase steps */}
              <div className="space-y-1">
                {PHASE_ORDER.filter(p => p !== 'done').map((phaseId) => {
                  const meta = PHASE_META[phaseId];
                  const PIcon = meta.icon;
                  const isDone = genState.completedPhases.has(phaseId);
                  const isActive = genState.currentPhase === phaseId && storeRunning;
                  return (
                    <div
                      key={phaseId}
                      className="flex items-center gap-3 px-3 py-2 rounded transition-all"
                      style={{
                        background: isActive ? `${accentColor}08` : 'transparent',
                        border: `1px solid ${isActive ? `${accentColor}22` : 'transparent'}`,
                      }}
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: isDone ? 'rgba(16,185,129,0.15)' : isActive ? `${accentColor}15` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : isActive ? `${accentColor}33` : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        {isDone
                          ? <CheckCircle2 size={10} style={{ color: '#10B981' }} />
                          : isActive
                          ? <Loader2 size={10} className="animate-spin" style={{ color: accentColor }} />
                          : <PIcon size={10} className="text-slate-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs" style={{ color: isDone ? '#10B981' : isActive ? accentColor : '#475569' }}>
                          {meta.label}
                        </div>
                      </div>
                      {isDone && <span className="text-xs font-mono text-emerald-600">✓</span>}
                    </div>
                  );
                })}
              </div>

              {/* Log terminal */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Terminal size={11} className="text-slate-600" />
                  <span className="text-xs text-slate-600">Generation Log</span>
                  {storeRunning && (
                    <span className="text-xs text-slate-600 ml-auto font-mono">{genState.logLines.length} lines</span>
                  )}
                </div>
                <div
                  ref={logRef}
                  className="rounded p-3 text-xs font-mono space-y-0.5 overflow-y-auto"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    maxHeight: '240px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.65rem',
                    lineHeight: '1.6',
                  }}
                >
                  {genState.logLines.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        color: line.includes('✓') ? '#10B981'
                          : line.includes('❌') || line.includes('Error') || line.includes('error') ? '#F43F5E'
                          : line.includes('⚠') || line.includes('Warning') ? '#F59E0B'
                          : line.includes('🎉') ? '#06B6D4'
                          : '#64748B',
                      }}
                    >
                      {line}
                    </div>
                  ))}
                  {storeRunning && (
                    <div style={{ color: accentColor }} className="animate-pulse">▋</div>
                  )}
                </div>
              </div>

              {genState.errorMsg && (
                <div
                  className="flex items-start gap-2 p-3 rounded text-xs"
                  style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', color: '#F43F5E' }}
                >
                  <AlertCircle size={12} className="mt-0.5 shrink-0" /> {genState.errorMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* Config stage footer */}
          {!showProgress && (
            <>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={!canGenerate || loadingProviders}
                className="flex items-center gap-2 px-6 py-2 rounded text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canGenerate ? accentColor : 'rgba(255,255,255,0.06)', color: canGenerate ? '#070B14' : '#64748B' }}
              >
                <Play size={14} /> Generate {totalSamples} Samples
              </button>
            </>
          )}

          {/* Running footer */}
          {storeRunning && (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin" style={{ color: accentColor }} />
                {genState.completedSamples}/{genState.totalSamples} samples · {progressPct}% complete
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
                  style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)', color: '#06B6D4' }}
                  title="Close panel without stopping generation"
                >
                  <Minimize2 size={12} /> Close (keep running)
                </button>
                <button
                  onClick={handleAbort}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all hover:bg-white/5"
                  style={{ color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}
                >
                  <StopCircle size={12} /> Cancel Job
                </button>
              </div>
            </div>
          )}

          {/* Done footer */}
          {storeDone && (
            <>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#10B981' }}>
                <CheckCircle2 size={13} /> {genState.completedSamples || genState.totalSamples} samples generated · Dataset ACTIVE
              </div>
              <button
                onClick={() => { handleReset(); onClose(); }}
                className="flex items-center gap-2 px-5 py-2 rounded text-sm font-medium transition-all"
                style={{ background: '#10B981', color: '#070B14' }}
              >
                Done <ChevronRight size={14} />
              </button>
            </>
          )}

          {/* Error footer */}
          {storeError && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
              >
                <RefreshCw size={13} /> Retry
              </button>
              <button onClick={() => { handleReset(); onClose(); }} className="text-xs text-slate-500 hover:text-slate-400">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
