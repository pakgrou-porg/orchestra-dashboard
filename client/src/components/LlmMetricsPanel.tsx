/* =============================================================
   LlmMetricsPanel — Per-provider LLM usage metrics
   Design: Cyberpunk Terminal — glass cards, cyan/violet accents.

   Reads from:
   - dataset_samples.metadata.provider_id (counts calls per provider)
   - llm_providers table (display names, pricing)
   
   Displays:
   - Total API calls (= total samples generated)
   - Samples generated per provider (with bar chart)
   - Estimated tokens (avg ~500 tokens/sample heuristic)
   - Estimated cost (using input_cost_per_million + output_cost_per_million from provider)
   ============================================================= */
import { useEffect, useState } from 'react';
import { supabase, LlmProvider } from '@/lib/supabase';
import { Zap, Database, TrendingUp, DollarSign, RefreshCw, Activity } from 'lucide-react';

// Average token estimates per sample (heuristic)
const AVG_INPUT_TOKENS = 350;   // system prompt + user prompt
const AVG_OUTPUT_TOKENS = 450;  // assistant response

// Default pricing fallbacks (per million tokens) if not set on provider
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  openrouter:  { input: 0.26,  output: 1.56 },
  anthropic:   { input: 3.00,  output: 15.00 },
  openai:      { input: 2.50,  output: 10.00 },
  gemini:      { input: 0.35,  output: 1.05 },
  venice:      { input: 0.50,  output: 1.50 },
  lmstudio_local:   { input: 0, output: 0 },
  lmstudio_network: { input: 0, output: 0 },
  custom:      { input: 0, output: 0 },
};

interface ProviderStats {
  provider: LlmProvider;
  sampleCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
}

interface Props {
  providers: LlmProvider[];
}

export default function LlmMetricsPanel({ providers }: Props) {
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch all dataset_samples metadata to count per provider
      const { data } = await supabase
        .from('dataset_samples')
        .select('metadata');

      const samples = data || [];

      // Count samples per provider_id
      const countByProvider: Record<string, number> = {};
      for (const s of samples) {
        const meta = s.metadata as Record<string, unknown>;
        const pid = meta?.provider_id as string | undefined;
        if (pid) {
          countByProvider[pid] = (countByProvider[pid] || 0) + 1;
        }
      }

      // Build stats for each active provider
      const result: ProviderStats[] = providers
        .filter(p => p.is_active)
        .map(p => {
          const count = countByProvider[p.id] || 0;
          const pricing = DEFAULT_PRICING[p.provider_type] || { input: 0, output: 0 };
          const inputCostPerM = (p.metadata?.input_cost_per_million as number | undefined) ?? pricing.input;
          const outputCostPerM = (p.metadata?.output_cost_per_million as number | undefined) ?? pricing.output;
          const inputTokens = count * AVG_INPUT_TOKENS;
          const outputTokens = count * AVG_OUTPUT_TOKENS;
          const cost = (inputTokens / 1_000_000) * inputCostPerM + (outputTokens / 1_000_000) * outputCostPerM;
          return {
            provider: p,
            sampleCount: count,
            estimatedInputTokens: inputTokens,
            estimatedOutputTokens: outputTokens,
            estimatedCost: cost,
          };
        })
        .sort((a, b) => b.sampleCount - a.sampleCount);

      setStats(result);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (providers.length > 0) {
      fetchStats();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  const totalSamples = stats.reduce((s, p) => s + p.sampleCount, 0);
  const totalTokens = stats.reduce((s, p) => s + p.estimatedInputTokens + p.estimatedOutputTokens, 0);
  const totalCost = stats.reduce((s, p) => s + p.estimatedCost, 0);
  const maxCount = Math.max(...stats.map(s => s.sampleCount), 1);

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const formatCost = (n: number) => {
    if (n === 0) return '$0.00';
    if (n < 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(3)}`;
  };

  const PROVIDER_COLORS: Record<string, string> = {
    openrouter: '#06B6D4',
    anthropic: '#D97706',
    openai: '#10B981',
    gemini: '#4285F4',
    venice: '#7C3AED',
    lmstudio_local: '#94A3B8',
    lmstudio_network: '#64748B',
    custom: '#475569',
  };

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            icon: Activity,
            label: 'Total API Calls',
            value: totalSamples.toLocaleString(),
            sub: 'samples generated',
            color: '#06B6D4',
          },
          {
            icon: Zap,
            label: 'Est. Tokens Used',
            value: formatTokens(totalTokens),
            sub: `~${AVG_INPUT_TOKENS}in + ${AVG_OUTPUT_TOKENS}out per call`,
            color: '#7C3AED',
          },
          {
            icon: DollarSign,
            label: 'Est. Total Cost',
            value: formatCost(totalCost),
            sub: 'based on provider pricing',
            color: '#10B981',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div
            key={label}
            className="glass-card rounded-lg p-4"
            style={{ border: `1px solid ${color}22` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded flex items-center justify-center"
                style={{ background: `${color}18`, border: `1px solid ${color}33` }}
              >
                <Icon size={13} style={{ color }} />
              </div>
              <span className="text-xs text-slate-500 uppercase tracking-wider" style={{ fontSize: '0.62rem' }}>{label}</span>
            </div>
            <div className="metric-value text-2xl font-bold text-slate-100">{value}</div>
            <div className="text-xs text-slate-600 mt-0.5 metric-value">{sub}</div>
          </div>
        ))}
      </div>

      {/* Per-provider breakdown */}
      <div className="glass-card rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} style={{ color: '#06B6D4' }} />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider" style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.65rem' }}>
              Usage by Provider
            </span>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-slate-600 metric-value">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all"
              style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06B6D4' }}
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" style={{ color: '#06B6D4' }} />
            Loading usage data…
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <Database size={20} className="mx-auto mb-2 text-slate-700" />
            No providers configured. Add providers via the LLM Provider Manager.
          </div>
        ) : (
          <div className="space-y-0">
            {/* Table header */}
            <div className="grid gap-2 pb-2 border-b border-white/5 text-xs text-slate-600 uppercase tracking-wider metric-value"
              style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 80px' }}>
              <span>Provider</span>
              <span className="text-right">Calls</span>
              <span className="text-right">Input Tok</span>
              <span className="text-right">Output Tok</span>
              <span className="text-right">Est. Cost</span>
              <span className="text-right">$/1M in</span>
            </div>

            {stats.map((s) => {
              const color = PROVIDER_COLORS[s.provider.provider_type] || '#64748B';
              const barPct = maxCount > 0 ? (s.sampleCount / maxCount) * 100 : 0;
              const pricing = DEFAULT_PRICING[s.provider.provider_type] || { input: 0, output: 0 };
              const inputCostPerM = (s.provider.metadata?.input_cost_per_million as number | undefined) ?? pricing.input;
              const isLocal = s.provider.provider_type === 'lmstudio_local' || s.provider.provider_type === 'lmstudio_network';

              return (
                <div
                  key={s.provider.id}
                  className="grid gap-2 py-2.5 border-b border-white/[0.04] last:border-0 items-center"
                  style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 80px' }}
                >
                  {/* Provider name + bar */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-xs text-slate-300 truncate">{s.provider.display_name}</span>
                      <span className="text-xs text-slate-600 truncate hidden xl:block font-mono" style={{ fontSize: '0.6rem' }}>
                        {s.provider.model_id.split('/').pop()}
                      </span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${barPct}%`, background: color }}
                      />
                    </div>
                  </div>

                  {/* Calls */}
                  <div className="text-right">
                    <span className="metric-value text-xs" style={{ color: s.sampleCount > 0 ? color : '#475569' }}>
                      {s.sampleCount.toLocaleString()}
                    </span>
                  </div>

                  {/* Input tokens */}
                  <div className="text-right">
                    <span className="metric-value text-xs text-slate-400">
                      {formatTokens(s.estimatedInputTokens)}
                    </span>
                  </div>

                  {/* Output tokens */}
                  <div className="text-right">
                    <span className="metric-value text-xs text-slate-400">
                      {formatTokens(s.estimatedOutputTokens)}
                    </span>
                  </div>

                  {/* Estimated cost */}
                  <div className="text-right">
                    <span className="metric-value text-xs" style={{ color: isLocal ? '#475569' : s.estimatedCost > 0 ? '#F59E0B' : '#475569' }}>
                      {isLocal ? 'FREE' : formatCost(s.estimatedCost)}
                    </span>
                  </div>

                  {/* Input cost per million */}
                  <div className="text-right">
                    <span className="metric-value text-xs text-slate-600">
                      {isLocal ? '—' : `$${inputCostPerM.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Totals row */}
            {totalSamples > 0 && (
              <div
                className="grid gap-2 pt-3 mt-1 items-center"
                style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 80px', borderTop: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="text-xs text-slate-500 uppercase tracking-wider metric-value">Total</div>
                <div className="text-right metric-value text-xs text-slate-200">{totalSamples.toLocaleString()}</div>
                <div className="text-right metric-value text-xs text-slate-400">{formatTokens(stats.reduce((s, p) => s + p.estimatedInputTokens, 0))}</div>
                <div className="text-right metric-value text-xs text-slate-400">{formatTokens(stats.reduce((s, p) => s + p.estimatedOutputTokens, 0))}</div>
                <div className="text-right metric-value text-xs" style={{ color: '#F59E0B' }}>{formatCost(totalCost)}</div>
                <div />
              </div>
            )}
          </div>
        )}

        {/* Pricing note */}
        <div className="mt-4 pt-3 border-t border-white/5 text-xs text-slate-600 leading-relaxed">
          <span className="text-slate-500">Pricing note:</span> Token counts are estimated ({AVG_INPUT_TOKENS} input + {AVG_OUTPUT_TOKENS} output per sample).
          Costs use OpenRouter/provider list prices. Local providers (LMStudio, Ollama) are free.
          Set custom pricing per provider via the Provider Manager → metadata fields.
        </div>
      </div>
    </div>
  );
}
