/* =============================================================
   AIRefinePanel — "Refine with AI" step in the Create Dataset wizard.
   Design: Cyberpunk Terminal — glass cards, cyan/violet accents.

   This panel:
   1. Analyses the current dataset config (task type, metric, system
      prompt template, categories) using the built-in Forge LLM API.
   2. Surfaces structured suggestions across three areas:
      - System Prompt improvements
      - Task Config / Metric recommendations
      - Category distribution advice
   3. Lets Karl accept individual suggestions (one-click apply) or
      apply all at once, then continue to the Review step.
   ============================================================= */
import { useState, useCallback } from 'react';
import {
  Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw,
  ChevronRight, ChevronDown, Check, X, Lightbulb,
  FileText, BarChart3, Tag, ArrowRight
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
export interface Suggestion {
  id: string;
  area: 'system_prompt' | 'task_config' | 'categories';
  severity: 'critical' | 'improvement' | 'optional';
  title: string;
  rationale: string;
  current?: string;
  suggested?: string;
  applied: boolean;
}

export interface AIAnalysis {
  overall_assessment: string;
  quality_score: number;          // 0–100
  suggestions: Suggestion[];
  refined_system_prompt?: string;
  recommended_task_type?: string;
  recommended_metric?: string;
  recommended_categories?: { label: string; count: number; color: string }[];
}

export interface LlmProviderConfig {
  provider_type: string;
  base_url: string | null;
  port: number | null;
  model_id: string;
  api_key_hint: string | null;
  display_name: string;
}

interface Props {
  // Current wizard state (read-only snapshot passed in)
  taskType: string;
  metricType: string;
  systemPromptTemplate: string;
  modelHint: string;
  numTrain: number;
  numEval: number;
  categories: { label: string; count: number; color: string }[];
  description: string;
  accentColor: string;
  // Optional: configured LLM provider to use for analysis
  llmProvider?: LlmProviderConfig | null;
  // Callbacks to apply suggestions back to wizard state
  onApplySystemPrompt: (prompt: string) => void;
  onApplyTaskType: (type: string) => void;
  onApplyMetric: (metric: string) => void;
  onApplyCategories: (cats: { label: string; count: number; color: string }[]) => void;
  onContinue: () => void;
  onSkip: () => void;
}

const AREA_META = {
  system_prompt: { label: 'System Prompt', icon: FileText, color: '#06B6D4' },
  task_config:   { label: 'Task & Metric', icon: BarChart3, color: '#7C3AED' },
  categories:    { label: 'Categories',    icon: Tag,       color: '#F59E0B' },
};

const SEVERITY_META = {
  critical:    { label: 'Critical',     color: '#F43F5E', bg: 'rgba(244,63,94,0.08)'   },
  improvement: { label: 'Improvement',  color: '#F59E0B', bg: 'rgba(245,158,11,0.08)'  },
  optional:    { label: 'Optional',     color: '#06B6D4', bg: 'rgba(6,182,212,0.08)'   },
};

// ── Build API endpoint from provider config ───────────────────
function buildApiEndpoint(provider?: LlmProviderConfig | null): { url: string; key: string; model: string } {
  if (!provider) {
    // Fallback to Forge
    const base = import.meta.env.VITE_FRONTEND_FORGE_API_URL || 'https://forge.butterfly-effect.dev';
    return { url: `${base}/v1/chat/completions`, key: import.meta.env.VITE_FRONTEND_FORGE_API_KEY || '', model: 'claude-3-5-sonnet' };
  }
  let baseUrl = provider.base_url || '';
  const port = provider.port;
  if (port && !baseUrl.includes(`:${port}`)) baseUrl = `${baseUrl}:${port}`;
  // Ensure /v1 path
  if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/')) baseUrl = `${baseUrl}/v1`;
  return { url: `${baseUrl}/chat/completions`, key: provider.api_key_hint || '', model: provider.model_id };
}

// ── LLM API call ───────────────────────────────────────────────
async function analyseWithAI(props: Omit<Props, 'accentColor' | 'onApplySystemPrompt' | 'onApplyTaskType' | 'onApplyMetric' | 'onApplyCategories' | 'onContinue' | 'onSkip'>): Promise<AIAnalysis> {
  const { url: forgeUrl, key: forgeKey, model: forgeModel } = buildApiEndpoint(props.llmProvider);

  const systemMsg = `You are an expert ML dataset architect specialising in fine-tuning small LLMs for specialised tasks.
You analyse dataset configurations for the Orchestra autoresearch framework and provide structured, actionable improvement suggestions.
Your analysis must be returned as a single valid JSON object matching the AIAnalysis schema exactly.
Do not include any text outside the JSON object.`;

  const userMsg = `Analyse this dataset configuration and return improvement suggestions as JSON.

## Current Configuration
- Task Type: ${props.taskType}
- Evaluation Metric: ${props.metricType}
- Model Hint: ${props.modelHint || 'not specified'}
- Train Samples: ${props.numTrain}
- Eval Samples: ${props.numEval}
- Description: ${props.description || 'not provided'}

## System Prompt Template
\`\`\`
${props.systemPromptTemplate || '(none provided)'}
\`\`\`

## Category Distribution
${props.categories.map(c => `- ${c.label}: ${c.count} samples`).join('\n') || '(none defined)'}

## Required JSON Response Schema
{
  "overall_assessment": "2-3 sentence summary of the configuration quality and main concerns",
  "quality_score": <integer 0-100>,
  "suggestions": [
    {
      "id": "unique_id",
      "area": "system_prompt" | "task_config" | "categories",
      "severity": "critical" | "improvement" | "optional",
      "title": "short title",
      "rationale": "1-2 sentence explanation",
      "current": "current value if applicable",
      "suggested": "suggested replacement if applicable"
    }
  ],
  "refined_system_prompt": "full improved system prompt text",
  "recommended_task_type": "task type slug if change recommended, else null",
  "recommended_metric": "metric slug if change recommended, else null",
  "recommended_categories": [{"label": "...", "count": <int>, "color": "<hex>"}] or null
}

Focus especially on:
1. Whether the task type and metric correctly match the actual task (OSquery generation is NOT sql_correction)
2. Whether the system prompt is specific enough, well-structured, and includes success/failure criteria
3. Whether category distribution is balanced and covers the right error/query types for OSquery
4. Whether the eval sample count (${props.numEval}) is sufficient for the metric
5. MITRE ATT&CK coverage in categories`;

  const resp = await fetch(`${forgeUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${forgeKey}`,
    },
    body: JSON.stringify({
      model: forgeModel,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
  const jsonStr = jsonMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr) as AIAnalysis;
    // Ensure applied flag is set
    parsed.suggestions = parsed.suggestions.map(s => ({ ...s, applied: false }));
    return parsed;
  } catch {
    throw new Error('AI returned invalid JSON. Please try again.');
  }
}

// ── Main Component ─────────────────────────────────────────────
export default function AIRefinePanel(props: Props) {
  const { accentColor, onApplySystemPrompt, onApplyTaskType, onApplyMetric,
          onApplyCategories, onContinue, onSkip } = props;

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [allApplied, setAllApplied] = useState(false);

  const runAnalysis = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setAnalysis(null);
    setAppliedIds(new Set());
    setAllApplied(false);
    try {
      const result = await analyseWithAI(props);
      setAnalysis(result);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [props]);

  const applySuggestion = useCallback((s: Suggestion) => {
    if (appliedIds.has(s.id)) return;
    if (s.area === 'system_prompt' && analysis?.refined_system_prompt) {
      onApplySystemPrompt(analysis.refined_system_prompt);
    }
    if (s.area === 'task_config') {
      if (analysis?.recommended_task_type) onApplyTaskType(analysis.recommended_task_type);
      if (analysis?.recommended_metric) onApplyMetric(analysis.recommended_metric);
    }
    if (s.area === 'categories' && analysis?.recommended_categories) {
      onApplyCategories(analysis.recommended_categories);
    }
    setAppliedIds(prev => new Set<string>(Array.from(prev).concat(s.id)));
  }, [analysis, appliedIds, onApplySystemPrompt, onApplyTaskType, onApplyMetric, onApplyCategories]);

  const applyAll = useCallback(() => {
    if (!analysis) return;
    if (analysis.refined_system_prompt) onApplySystemPrompt(analysis.refined_system_prompt);
    if (analysis.recommended_task_type) onApplyTaskType(analysis.recommended_task_type);
    if (analysis.recommended_metric) onApplyMetric(analysis.recommended_metric);
    if (analysis.recommended_categories) onApplyCategories(analysis.recommended_categories);
    const allIds = new Set<string>(Array.from(analysis.suggestions.map(s => s.id)));
    setAppliedIds(allIds);
    setAllApplied(true);
  }, [analysis, onApplySystemPrompt, onApplyTaskType, onApplyMetric, onApplyCategories]);

  const scoreColor = (score: number) =>
    score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#F43F5E';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', letterSpacing: '0.06em', color: accentColor }}
        >
          REFINE WITH AI
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Analyse your dataset configuration and get AI-powered suggestions to improve the system prompt,
          task type, evaluation metric, and category distribution before saving.
        </p>
      </div>

      {/* Idle state — prompt to run */}
      {status === 'idle' && (
        <div
          className="rounded-lg p-6 flex flex-col items-center text-center gap-4"
          style={{ background: `${accentColor}06`, border: `1px dashed ${accentColor}33` }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}33` }}
          >
            <Sparkles size={22} style={{ color: accentColor }} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-200 mb-1">Ready to analyse your configuration</div>
            <div className="text-xs text-slate-500 max-w-sm">
              The AI will review your system prompt, task type, metric, and category distribution
              and suggest targeted improvements.
            </div>
          </div>
          {/* Provider info */}
          <div className="text-xs px-3 py-2 rounded w-full text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {props.llmProvider ? (
              <span className="text-slate-400">Using: <span style={{ color: accentColor }} className="metric-value">{props.llmProvider.display_name}</span> — <span className="text-slate-500 metric-value">{props.llmProvider.model_id}</span></span>
            ) : (
              <span className="text-slate-500">No provider configured — using built-in Forge API. <span className="text-slate-600">Add a provider in LLM Provider Manager for better results.</span></span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runAnalysis}
              className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-all"
              style={{ background: accentColor, color: '#070B14' }}
            >
              <Sparkles size={14} /> Analyse Configuration
            </button>
            <button
              onClick={onSkip}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Skip → Review
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {status === 'loading' && (
        <div
          className="rounded-lg p-8 flex flex-col items-center text-center gap-3"
          style={{ background: `${accentColor}06`, border: `1px solid ${accentColor}22` }}
        >
          <Loader2 size={28} className="animate-spin" style={{ color: accentColor }} />
          <div className="text-sm text-slate-300">Analysing configuration…</div>
          <div className="text-xs text-slate-500">
            Checking task alignment, prompt quality, metric suitability, and category coverage
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.25)' }}
        >
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle size={15} /> Analysis failed
          </div>
          <div className="text-xs text-slate-500">{error}</div>
          <div className="flex gap-2">
            <button
              onClick={runAnalysis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
              style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#F43F5E' }}
            >
              <RefreshCw size={11} /> Retry
            </button>
            <button onClick={onSkip} className="text-xs text-slate-500 hover:text-slate-400 px-3 py-1.5">
              Skip → Review
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {status === 'done' && analysis && (
        <div className="space-y-4">
          {/* Score card */}
          <div
            className="rounded-lg p-4 flex items-center gap-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `${scoreColor(analysis.quality_score)}15`,
                border: `2px solid ${scoreColor(analysis.quality_score)}44`,
              }}
            >
              <span
                className="text-lg font-bold metric-value"
                style={{ color: scoreColor(analysis.quality_score), fontFamily: 'JetBrains Mono, monospace' }}
              >
                {analysis.quality_score}
              </span>
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-400 mb-1">Configuration Quality Score</div>
              <div className="text-xs text-slate-400 leading-relaxed">{analysis.overall_assessment}</div>
            </div>
            <button
              onClick={runAnalysis}
              className="w-7 h-7 rounded flex items-center justify-center text-slate-600 hover:text-slate-400 transition-colors shrink-0"
              title="Re-analyse"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {/* Apply all */}
          {analysis.suggestions.length > 0 && !allApplied && (
            <button
              onClick={applyAll}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-all"
              style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}33`, color: accentColor }}
            >
              <Check size={14} /> Apply All {analysis.suggestions.length} Suggestions
            </button>
          )}
          {allApplied && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded text-sm"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981' }}
            >
              <CheckCircle2 size={14} /> All suggestions applied — review your changes below
            </div>
          )}

          {/* Suggestions list */}
          <div className="space-y-2">
            {analysis.suggestions.map(s => {
              const area = AREA_META[s.area];
              const sev = SEVERITY_META[s.severity];
              const AreaIcon = area.icon;
              const isApplied = appliedIds.has(s.id);
              const isExpanded = expandedSuggestion === s.id;

              return (
                <div
                  key={s.id}
                  className="rounded-lg overflow-hidden transition-all"
                  style={{ border: `1px solid ${isApplied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}` }}
                >
                  {/* Header row */}
                  <button
                    onClick={() => setExpandedSuggestion(isExpanded ? null : s.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-white/[0.02]"
                  >
                    <AreaIcon size={13} style={{ color: area.color, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200 truncate">{s.title}</span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded metric-value shrink-0"
                          style={{ background: sev.bg, color: sev.color, fontSize: '0.6rem' }}
                        >
                          {sev.label}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded metric-value shrink-0"
                          style={{ background: `${area.color}12`, color: area.color, fontSize: '0.6rem' }}
                        >
                          {area.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isApplied
                        ? <CheckCircle2 size={14} style={{ color: '#10B981' }} />
                        : (
                          <button
                            onClick={e => { e.stopPropagation(); applySuggestion(s); }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
                            style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}33`, color: accentColor }}
                          >
                            <ArrowRight size={10} /> Apply
                          </button>
                        )
                      }
                      {isExpanded
                        ? <ChevronDown size={13} className="text-slate-500" />
                        : <ChevronRight size={13} className="text-slate-500" />
                      }
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div
                      className="px-3 pb-3 space-y-2"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <p className="text-xs text-slate-400 pt-2 leading-relaxed">{s.rationale}</p>
                      {s.current && (
                        <div className="space-y-1">
                          <div className="text-xs text-slate-600 font-medium">Current</div>
                          <div
                            className="text-xs text-slate-400 p-2 rounded metric-value"
                            style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                          >
                            {s.current}
                          </div>
                        </div>
                      )}
                      {s.suggested && (
                        <div className="space-y-1">
                          <div className="text-xs text-slate-600 font-medium">Suggested</div>
                          <div
                            className="text-xs text-slate-300 p-2 rounded metric-value"
                            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                          >
                            {s.suggested}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Refined prompt preview */}
          {analysis.refined_system_prompt && (
            <div>
              <div className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-2">
                <Lightbulb size={11} style={{ color: '#06B6D4' }} />
                Refined System Prompt Preview
              </div>
              <div
                className="text-xs text-slate-400 p-3 rounded leading-relaxed"
                style={{
                  background: 'rgba(6,182,212,0.04)',
                  border: '1px solid rgba(6,182,212,0.15)',
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {analysis.refined_system_prompt}
              </div>
            </div>
          )}

          {/* Continue / dismiss */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              <X size={11} /> Discard suggestions
            </button>
            <button
              onClick={onContinue}
              className="flex items-center gap-2 px-5 py-2 rounded text-sm font-medium transition-all"
              style={{ background: accentColor, color: '#070B14' }}
            >
              Continue to Review <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
