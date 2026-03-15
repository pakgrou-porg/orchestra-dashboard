/* =============================================================
   generationStore.ts — Module-level singleton for background dataset generation.

   Allows the GenerateDatasetPanel to be closed without cancelling the job.
   The generation continues in the background and the panel can be re-opened
   to check progress. Subscribers (React components) are notified via callbacks.
   ============================================================= */
import { Dataset, LlmProvider } from '@/lib/supabase';
import { generateDataset, GenerationProgress } from '@/lib/datasetGenerator';
import { supabase } from '@/lib/supabase';

export type GenStage = 'idle' | 'running' | 'done' | 'error';

export interface GenState {
  stage: GenStage;
  datasetId: string | null;
  datasetName: string;
  providerName: string;
  completedSamples: number;
  totalSamples: number;
  progressPct: number;
  currentPhase: string | null;
  completedPhases: Set<string>;
  logLines: string[];
  errorMsg: string | null;
  elapsedMs: number;
  startedAt: number | null;
}

const INITIAL_STATE: GenState = {
  stage: 'idle',
  datasetId: null,
  datasetName: '',
  providerName: '',
  completedSamples: 0,
  totalSamples: 0,
  progressPct: 0,
  currentPhase: null,
  completedPhases: new Set(),
  logLines: [],
  errorMsg: null,
  elapsedMs: 0,
  startedAt: null,
};

// Module-level singleton state
let state: GenState = { ...INITIAL_STATE, completedPhases: new Set() };
let abortController: AbortController | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach(fn => fn());
}

function addLog(line: string) {
  const ts = new Date().toISOString().slice(11, 23);
  state = {
    ...state,
    logLines: [...state.logLines.slice(-120), `[${ts}] ${line}`],
  };
  notify();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    state = { ...state, elapsedMs: state.elapsedMs + 250 };
    notify();
  }, 250);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

export const generationStore = {
  getState(): GenState {
    return state;
  },

  subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },

  isRunning(): boolean {
    return state.stage === 'running';
  },

  canStart(): boolean {
    return state.stage === 'idle' || state.stage === 'done' || state.stage === 'error';
  },

  async start(
    dataset: Dataset,
    provider: LlmProvider,
    concurrency: number,
    totalSamples: number,
    onGenerated: () => void,
  ): Promise<void> {
    if (state.stage === 'running') return; // already running

    const PHASE_ORDER = ['validate', 'scaffold', 'generate_train', 'generate_eval', 'validate_samples', 'register', 'done'];

    state = {
      ...INITIAL_STATE,
      completedPhases: new Set(),
      stage: 'running',
      datasetId: dataset.id,
      datasetName: dataset.name,
      providerName: provider.display_name,
      totalSamples,
      startedAt: Date.now(),
    };
    notify();
    startTimer();

    abortController = new AbortController();

    // Update status to 'generating'
    await supabase.from('datasets').update({ status: 'generating' }).eq('id', dataset.id);
    addLog(`Dataset "${dataset.name}" status → generating`);
    addLog(`Provider: ${provider.display_name} (${provider.model_id})`);
    addLog(`Concurrency: ${concurrency} parallel requests`);

    try {
      await generateDataset(
        dataset,
        provider,
        concurrency,
        (progress: GenerationProgress) => {
          addLog(progress.log);

          const newCompleted = progress.completed;
          const newPct = totalSamples > 0 ? Math.round((newCompleted / totalSamples) * 100) : 0;

          if (progress.phase === 'done') {
            state = {
              ...state,
              completedSamples: newCompleted,
              progressPct: 100,
              currentPhase: 'done',
              completedPhases: new Set(PHASE_ORDER),
            };
          } else if (progress.phase !== 'error') {
            const phaseIdx = PHASE_ORDER.indexOf(progress.phase);
            const newCompleted2 = new Set(state.completedPhases);
            for (let i = 0; i < phaseIdx; i++) newCompleted2.add(PHASE_ORDER[i]);
            state = {
              ...state,
              completedSamples: newCompleted,
              progressPct: newPct,
              currentPhase: progress.phase,
              completedPhases: newCompleted2,
            };
          }
          notify();
        },
        abortController.signal,
      );

      stopTimer();
      addLog('🎉 Generation complete — dataset is now ACTIVE');
      state = { ...state, stage: 'done', progressPct: 100 };
      notify();
      onGenerated();
    } catch (err: unknown) {
      stopTimer();
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Generation failed: ${msg}`);
      state = { ...state, stage: 'error', errorMsg: msg };
      notify();
      // Revert status to draft on failure
      await supabase.from('datasets').update({ status: 'draft' }).eq('id', dataset.id);
    }
  },

  abort() {
    abortController?.abort();
    addLog('⚠ Cancellation requested — waiting for in-flight requests to complete…');
  },

  reset() {
    stopTimer();
    state = { ...INITIAL_STATE, completedPhases: new Set() };
    notify();
  },
};
