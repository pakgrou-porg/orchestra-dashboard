/* =============================================================
   DatasetReviewPanel — Inline sample viewer + download controls
   Design: Cyberpunk Terminal — glass cards, cyan/violet accents
   ============================================================= */
import { useState, useEffect, useCallback } from 'react';
import { supabase, Dataset, DatasetSample } from '@/lib/supabase';
import {
  ChevronLeft, ChevronRight, Download, X, Search,
  FileCode2, Shield, Filter, Loader2, Eye, Zap
} from 'lucide-react';

const PAGE_SIZE = 10;

type Props = {
  dataset: Dataset;
  onClose: () => void;
  onGenerate?: () => void;
};

export default function DatasetReviewPanel({ dataset, onClose, onGenerate }: Props) {
  const [samples, setSamples] = useState<DatasetSample[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [split, setSplit] = useState<'all' | 'train' | 'eval'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  // Live split counts from actual DB rows (not stale metadata)
  const [trainCount, setTrainCount] = useState(0);
  const [evalCount, setEvalCount] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [split, debouncedSearch]);

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('dataset_samples')
        .select('*', { count: 'exact' })
        .eq('dataset_id', dataset.id)
        .order('split', { ascending: true })
        .order('index', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (split !== 'all') query = query.eq('split', split);
      if (debouncedSearch) {
        query = query.or(
          `user_prompt.ilike.%${debouncedSearch}%,assistant_response.ilike.%${debouncedSearch}%`
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setSamples(data || []);
      setTotal(count || 0);

      // Also fetch live split counts on first load (all filter, no search)
      if (split === 'all' && !debouncedSearch) {
        const [trainRes, evalRes] = await Promise.all([
          supabase.from('dataset_samples').select('*', { count: 'exact', head: true }).eq('dataset_id', dataset.id).eq('split', 'train'),
          supabase.from('dataset_samples').select('*', { count: 'exact', head: true }).eq('dataset_id', dataset.id).eq('split', 'eval'),
        ]);
        setTrainCount(trainRes.count || 0);
        setEvalCount(evalRes.count || 0);
      }
    } catch (err) {
      console.error('Fetch samples error:', err);
    } finally {
      setLoading(false);
    }
  }, [dataset.id, page, split, debouncedSearch]);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  // ── Download helpers ──────────────────────────────────────────
  const downloadSplit = async (targetSplit: 'train' | 'eval' | 'all') => {
    setDownloading(targetSplit);
    try {
      let query = supabase
        .from('dataset_samples')
        .select('split,index,system_prompt,user_prompt,assistant_response,metadata')
        .eq('dataset_id', dataset.id)
        .order('split')
        .order('index');

      if (targetSplit !== 'all') query = query.eq('split', targetSplit);

      const { data, error } = await query;
      if (error) throw error;

      const jsonl = (data || [])
        .map(s => JSON.stringify({
          system: s.system_prompt,
          user: s.user_prompt,
          assistant: s.assistant_response,
        }))
        .join('\n');

      const blob = new Blob([jsonl], { type: 'application/jsonlines' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.name}_${targetSplit}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isSql = dataset.task_type === 'sql_correction';
  const accentColor = isSql ? '#06B6D4' : '#7C3AED';
  const TaskIcon = isSql ? FileCode2 : Shield;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full max-w-3xl flex flex-col overflow-hidden"
        style={{
          background: '#0A0F1A',
          borderLeft: `1px solid ${accentColor}33`,
          boxShadow: `-20px 0 60px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${accentColor}22`, background: `${accentColor}08` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}
            >
              <TaskIcon size={15} style={{ color: accentColor }} />
            </div>
            <div>
              <div className="font-semibold text-slate-100 text-sm metric-value">{dataset.name}</div>
              <div className="text-xs text-slate-500">{dataset.version} · {dataset.task_type.replace('_', ' ')}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Split filter */}
          <div className="flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '2px' }}>
            {(['all', 'train', 'eval'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSplit(s)}
                className="px-3 py-1 text-xs rounded transition-all metric-value"
                style={split === s
                  ? { background: accentColor, color: '#070B14', fontWeight: 600 }
                  : { color: '#64748B' }
                }
              >
                {s === 'all' ? `All (${trainCount + evalCount})` : s === 'train' ? `Train (${trainCount})` : `Eval (${evalCount})`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search prompts..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded outline-none text-slate-300 placeholder-slate-600"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>

          {/* Download buttons */}
          <div className="flex items-center gap-1.5">
            {(['train', 'eval', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => downloadSplit(s)}
                disabled={!!downloading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded transition-all"
                style={{
                  background: s === 'all' ? `${accentColor}18` : 'rgba(255,255,255,0.04)',
                  border: s === 'all' ? `1px solid ${accentColor}44` : '1px solid rgba(255,255,255,0.07)',
                  color: s === 'all' ? accentColor : '#64748B',
                }}
                title={`Download ${s} split as JSONL`}
              >
                {downloading === s ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                <span className="metric-value">{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="px-5 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter size={11} />
            <span>{total.toLocaleString()} sample{total !== 1 ? 's' : ''}</span>
            {debouncedSearch && <span style={{ color: accentColor }}>matching "{debouncedSearch}"</span>}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 metric-value">
              Page {page + 1} / {totalPages}
            </div>
          )}
        </div>

        {/* Sample list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: accentColor }} />
            </div>
          ) : samples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {trainCount === 0 && evalCount === 0 && !debouncedSearch ? (
                <>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}30` }}
                  >
                    <Zap size={22} style={{ color: accentColor }} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400 font-medium mb-1">No samples generated yet</div>
                    <div className="text-xs text-slate-600 mb-4">This dataset has not been generated. Run generation to populate samples.</div>
                    {onGenerate && (
                      <button
                        onClick={() => { onClose(); onGenerate(); }}
                        className="px-4 py-2 text-xs rounded font-semibold transition-all"
                        style={{ background: accentColor, color: '#070B14' }}
                      >
                        Generate Dataset
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-slate-600 text-sm">No samples found.</div>
              )}
            </div>
          ) : (
            samples.map((s) => (
              <SampleCard
                key={s.id}
                sample={s}
                expanded={expanded === s.id}
                onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                accentColor={accentColor}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="px-5 py-3 flex items-center justify-between shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#94A3B8' }}
            >
              <ChevronLeft size={13} /> Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-7 h-7 text-xs rounded transition-all metric-value"
                    style={p === page
                      ? { background: accentColor, color: '#070B14', fontWeight: 700 }
                      : { background: 'rgba(255,255,255,0.03)', color: '#475569', border: '1px solid rgba(255,255,255,0.06)' }
                    }
                  >
                    {p + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#94A3B8' }}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual Sample Card ─────────────────────────────────────
function SampleCard({
  sample, expanded, onToggle, accentColor
}: {
  sample: DatasetSample;
  expanded: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  const splitColor = sample.split === 'train' ? '#06B6D4' : '#7C3AED';

  return (
    <div
      className="rounded-lg overflow-hidden transition-all cursor-pointer"
      style={{
        background: expanded ? `${accentColor}06` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${expanded ? accentColor + '33' : 'rgba(255,255,255,0.05)'}`,
      }}
      onClick={onToggle}
    >
      {/* Collapsed header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <span
            className="metric-value text-xs px-1.5 py-0.5 rounded"
            style={{ background: `${splitColor}18`, color: splitColor, border: `1px solid ${splitColor}33`, fontSize: '0.6rem' }}
          >
            {sample.split}
          </span>
          <span className="metric-value text-xs text-slate-600">#{sample.index}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-xs text-slate-400 truncate"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {sample.user_prompt.replace(/\n/g, ' ').substring(0, 120)}
            {sample.user_prompt.length > 120 ? '…' : ''}
          </div>
        </div>
        <Eye
          size={13}
          className="shrink-0 mt-0.5 transition-colors"
          style={{ color: expanded ? accentColor : '#334155' }}
        />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {sample.system_prompt && (
            <FieldBlock label="SYSTEM" content={sample.system_prompt} color="#64748B" />
          )}
          <FieldBlock label="USER" content={sample.user_prompt} color={accentColor} />
          <FieldBlock label="ASSISTANT" content={sample.assistant_response} color="#10B981" />
        </div>
      )}
    </div>
  );
}

function FieldBlock({ label, content, color }: { label: string; content: string; color: string }) {
  return (
    <div>
      <div
        className="text-xs font-semibold mb-1.5 metric-value tracking-widest"
        style={{ color, fontSize: '0.6rem' }}
      >
        {label}
      </div>
      <pre
        className="text-xs text-slate-300 whitespace-pre-wrap break-words rounded p-3 overflow-auto max-h-48"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${color}22`,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.6,
        }}
      >
        {content}
      </pre>
    </div>
  );
}
