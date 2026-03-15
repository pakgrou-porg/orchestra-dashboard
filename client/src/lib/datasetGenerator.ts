/* =============================================================
 * datasetGenerator.ts — Real LLM-powered dataset generation engine
 * Design: Cyberpunk Terminal / Sci-Fi Operations Dashboard
 *
 * Generates dataset_samples rows by calling the configured LLM
 * provider for each category, writing results to Supabase.
 *
 * Architecture:
 *   - Reads generation_config.categories for distribution
 *   - Builds a per-sample prompt using system_prompt + category
 *   - Calls chatCompletion() with concurrency control (semaphore)
 *   - Writes each batch to dataset_samples via Supabase upsert
 *   - Emits progress events via a callback
 * ============================================================= */

import { supabase, Dataset, LlmProvider } from './supabase';
import { chatCompletion } from './llmProvider';

export interface GenerationProgress {
  phase: 'validate' | 'scaffold' | 'generate_train' | 'generate_eval' | 'validate_samples' | 'register' | 'done' | 'error';
  phaseLabel: string;
  completed: number;   // samples completed so far
  total: number;       // total samples to generate
  log: string;         // latest log line
  error?: string;
}

export type ProgressCallback = (p: GenerationProgress) => void;

interface Category {
  label: string;
  count: number;
  color?: string;
}

interface GenerationConfig {
  categories?: Category[];
  system_prompt?: string;
  system_prompt_template?: string;
  generation_notes?: string;
  model_hint?: string;
}

// ── Prompt builders ──────────────────────────────────────────────

function buildSystemPrompt(cfg: GenerationConfig): string {
  // Prefer the richer system_prompt, fall back to system_prompt_template
  return (cfg.system_prompt || cfg.system_prompt_template || '').trim() ||
    'You are an expert AI assistant. Generate high-quality training samples.';
}

function buildUserPrompt(
  dataset: Dataset,
  category: Category,
  sampleIndex: number,
  split: 'train' | 'eval',
  cfg: GenerationConfig,
): string {
  const notes = cfg.generation_notes ? `\n\nAdditional notes:\n${cfg.generation_notes}` : '';
  const splitNote = split === 'eval'
    ? '\n\nIMPORTANT: This is an evaluation sample. Make it distinct from training samples — use a different scenario, edge case, or complexity level.'
    : '';

  return `Generate a single high-quality ${dataset.task_type} training sample for the category: "${category.label}".

Dataset: ${dataset.name}
Task type: ${dataset.task_type}
Evaluation metric: ${dataset.metric_type}
Category: ${category.label}
Sample index: ${sampleIndex + 1}${splitNote}${notes}

Return a JSON object with exactly these fields:
{
  "user_prompt": "<the input/question/task for this sample>",
  "assistant_response": "<the ideal output/answer/solution>"
}

Return ONLY the JSON object, no markdown fences, no explanation.`;
}

// ── Concurrency semaphore ────────────────────────────────────────

class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>(resolve => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}

// ── Main generation function ─────────────────────────────────────

export async function generateDataset(
  dataset: Dataset,
  provider: LlmProvider,
  concurrency: number,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<void> {
  const cfg = (dataset.generation_config || {}) as GenerationConfig;
  const categories: Category[] = cfg.categories || [];
  const systemPrompt = buildSystemPrompt(cfg);
  const totalTrain = dataset.num_train || 0;
  const totalEval = dataset.num_eval || 0;
  const totalSamples = totalTrain + totalEval;

  const emit = (phase: GenerationProgress['phase'], label: string, log: string, completed = 0) => {
    onProgress({ phase, phaseLabel: label, completed, total: totalSamples, log });
  };

  // ── Phase 1: Validate ──────────────────────────────────────────
  emit('validate', 'Validate Configuration', `Checking dataset schema for "${dataset.name}"…`);
  await sleep(300);
  if (!systemPrompt) throw new Error('No system prompt configured. Edit the dataset and add a System Prompt Template.');
  if (categories.length === 0) throw new Error('No categories defined in generation_config. Edit the dataset to add categories.');
  emit('validate', 'Validate Configuration', `Task type: ${dataset.task_type} ✓`);
  await sleep(200);
  emit('validate', 'Validate Configuration', `${categories.length} categories, ${totalTrain} train + ${totalEval} eval samples ✓`);
  await sleep(200);

  // ── Phase 2: Scaffold ──────────────────────────────────────────
  emit('scaffold', 'Scaffold Output Directories', `Preparing Supabase dataset_samples for dataset_id=${dataset.id}…`);
  // Delete any existing samples for this dataset (fresh generation)
  const { error: delErr } = await supabase
    .from('dataset_samples')
    .delete()
    .eq('dataset_id', dataset.id);
  if (delErr) {
    emit('scaffold', 'Scaffold Output Directories', `Warning: could not clear existing samples: ${delErr.message}`);
  } else {
    emit('scaffold', 'Scaffold Output Directories', `Cleared existing samples ✓`);
  }
  await sleep(200);

  // ── Phase 3: Generate train split ─────────────────────────────
  emit('generate_train', 'Generate Train Split', `Initialising ${provider.model_id} (concurrency=${concurrency})…`, 0);
  await sleep(300);

  // Distribute train samples across categories proportionally
  const trainDistribution = distributeAcrossCategories(categories, totalTrain);
  const evalDistribution = distributeAcrossCategories(categories, totalEval);

  let completedCount = 0;
  const semaphore = new Semaphore(concurrency);

  // Generate train samples
  const trainSamples: Array<{
    dataset_id: string; split: 'train' | 'eval'; index: number;
    system_prompt: string; user_prompt: string; assistant_response: string;
    metadata: Record<string, unknown>;
  }> = [];

  let trainIndex = 0;
  for (const { category, count } of trainDistribution) {
    emit('generate_train', 'Generate Train Split',
      `  Generating ${count} samples for category: ${category.label}…`, completedCount);

    const batchPromises: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new Error('Generation cancelled by user.');
      const idx = trainIndex++;
      const catIdx = i;

      const task = async () => {
        await semaphore.acquire();
        try {
          if (signal?.aborted) return;
          const userPrompt = buildUserPrompt(dataset, category, catIdx, 'train', cfg);
          const raw = await chatCompletion(provider, {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            maxTokens: provider.max_tokens || 1024,
            temperature: provider.temperature ?? 0.7,
          });

          const parsed = parseGeneratedSample(raw);
          trainSamples.push({
            dataset_id: dataset.id,
            split: 'train',
            index: idx,
            system_prompt: systemPrompt,
            user_prompt: parsed.user_prompt,
            assistant_response: parsed.assistant_response,
            metadata: { category: category.label, generated_by: provider.model_id, provider_id: provider.id },
          });

          completedCount++;
          onProgress({
            phase: 'generate_train',
            phaseLabel: 'Generate Train Split',
            completed: completedCount,
            total: totalSamples,
            log: `  [${completedCount}/${totalTrain}] ${category.label} sample generated ✓`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          onProgress({
            phase: 'generate_train',
            phaseLabel: 'Generate Train Split',
            completed: completedCount,
            total: totalSamples,
            log: `  ⚠ Sample ${idx} failed (${category.label}): ${msg.slice(0, 80)}`,
          });
          // Push a placeholder so index stays consistent
          trainSamples.push({
            dataset_id: dataset.id,
            split: 'train',
            index: idx,
            system_prompt: systemPrompt,
            user_prompt: `[Generation failed: ${msg.slice(0, 100)}]`,
            assistant_response: '',
            metadata: { category: category.label, error: msg, provider_id: provider.id },
          });
          completedCount++;
        } finally {
          semaphore.release();
        }
      };
      batchPromises.push(task());
    }
    await Promise.all(batchPromises);
  }

  emit('generate_train', 'Generate Train Split', `Train split complete: ${trainSamples.length} samples ✓`, completedCount);

  // ── Phase 4: Generate eval split ──────────────────────────────
  emit('generate_eval', 'Generate Eval Split',
    `Generating ${totalEval} evaluation samples (held-out)…`, completedCount);

  const evalSamples: typeof trainSamples = [];
  let evalIndex = 0;

  for (const { category, count } of evalDistribution) {
    if (signal?.aborted) throw new Error('Generation cancelled by user.');
    emit('generate_eval', 'Generate Eval Split',
      `  Generating ${count} eval samples for: ${category.label}…`, completedCount);

    const batchPromises: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new Error('Generation cancelled by user.');
      const idx = evalIndex++;
      const catIdx = i;

      const task = async () => {
        await semaphore.acquire();
        try {
          if (signal?.aborted) return;
          const userPrompt = buildUserPrompt(dataset, category, catIdx, 'eval', cfg);
          const raw = await chatCompletion(provider, {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            maxTokens: provider.max_tokens || 1024,
            temperature: Math.max(0.3, (provider.temperature ?? 0.7) - 0.1),
          });

          const parsed = parseGeneratedSample(raw);
          evalSamples.push({
            dataset_id: dataset.id,
            split: 'eval',
            index: idx,
            system_prompt: systemPrompt,
            user_prompt: parsed.user_prompt,
            assistant_response: parsed.assistant_response,
            metadata: { category: category.label, generated_by: provider.model_id, provider_id: provider.id },
          });

          completedCount++;
          onProgress({
            phase: 'generate_eval',
            phaseLabel: 'Generate Eval Split',
            completed: completedCount,
            total: totalSamples,
            log: `  [${completedCount - totalTrain}/${totalEval}] ${category.label} eval sample ✓`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          evalSamples.push({
            dataset_id: dataset.id,
            split: 'eval',
            index: idx,
            system_prompt: systemPrompt,
            user_prompt: `[Generation failed: ${msg.slice(0, 100)}]`,
            assistant_response: '',
            metadata: { category: category.label, error: msg, provider_id: provider.id },
          });
          completedCount++;
        } finally {
          semaphore.release();
        }
      };
      batchPromises.push(task());
    }
    await Promise.all(batchPromises);
  }

  emit('generate_eval', 'Generate Eval Split', `Eval split complete: ${evalSamples.length} samples ✓`, completedCount);

  // ── Phase 5: Validate samples ──────────────────────────────────
  emit('validate_samples', 'Validate Samples', `Running quality checks on ${trainSamples.length + evalSamples.length} samples…`, completedCount);
  await sleep(300);

  const allSamples = [...trainSamples, ...evalSamples];
  const failed = allSamples.filter(s => s.assistant_response === '');
  const successRate = ((allSamples.length - failed.length) / allSamples.length * 100).toFixed(1);

  emit('validate_samples', 'Validate Samples', `Success rate: ${successRate}% (${allSamples.length - failed.length}/${allSamples.length}) ✓`, completedCount);
  if (failed.length > 0) {
    emit('validate_samples', 'Validate Samples', `⚠ ${failed.length} samples failed generation (kept as placeholders)`, completedCount);
  }
  await sleep(200);

  // ── Phase 6: Register in Supabase ─────────────────────────────
  emit('register', 'Register in Supabase', `Inserting ${allSamples.length} samples into dataset_samples…`, completedCount);

  // Insert in batches of 50 to avoid payload limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < allSamples.length; i += BATCH_SIZE) {
    const batch = allSamples.slice(i, i + BATCH_SIZE);
    const { error: insertErr } = await supabase.from('dataset_samples').insert(batch);
    if (insertErr) {
      throw new Error(`Failed to insert samples batch ${i}–${i + batch.length}: ${insertErr.message}`);
    }
    emit('register', 'Register in Supabase',
      `  Inserted samples ${i + 1}–${Math.min(i + BATCH_SIZE, allSamples.length)} ✓`, completedCount);
    await sleep(100);
  }

  // Update dataset status → active and record generation metadata
  const { error: updateErr } = await supabase
    .from('datasets')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', dataset.id);

  if (updateErr) {
    emit('register', 'Register in Supabase', `⚠ Status update failed: ${updateErr.message}`, completedCount);
  } else {
    emit('register', 'Register in Supabase', `Dataset status → active ✓`, completedCount);
  }

  emit('done', 'Complete', `🎉 Generation complete — ${allSamples.length} samples registered`, totalSamples);
}

// ── Helpers ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Distribute N samples across categories proportionally to their configured counts */
function distributeAcrossCategories(
  categories: Category[],
  total: number,
): Array<{ category: Category; count: number }> {
  if (categories.length === 0) return [];

  const configuredTotal = categories.reduce((s, c) => s + (c.count || 0), 0);

  if (configuredTotal === 0) {
    // Equal distribution
    const perCat = Math.floor(total / categories.length);
    const remainder = total % categories.length;
    return categories.map((category, i) => ({
      category,
      count: perCat + (i < remainder ? 1 : 0),
    }));
  }

  // Proportional distribution
  let remaining = total;
  const result: Array<{ category: Category; count: number }> = [];

  for (let i = 0; i < categories.length; i++) {
    const isLast = i === categories.length - 1;
    const count = isLast
      ? remaining
      : Math.round((categories[i].count / configuredTotal) * total);
    result.push({ category: categories[i], count: Math.max(0, count) });
    remaining -= count;
  }

  return result;
}

/** Parse the LLM response into user_prompt + assistant_response */
function parseGeneratedSample(raw: string): { user_prompt: string; assistant_response: string } {
  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const userPrompt = String(parsed.user_prompt || parsed.input || parsed.question || parsed.prompt || '').trim();
    const assistantResponse = String(
      parsed.assistant_response || parsed.response || parsed.output || parsed.answer || parsed.completion || ''
    ).trim();

    if (!userPrompt && !assistantResponse) {
      throw new Error('Parsed JSON has no recognisable fields');
    }

    return {
      user_prompt: userPrompt || '[No user prompt in response]',
      assistant_response: assistantResponse || cleaned,
    };
  } catch {
    // If not valid JSON, treat the whole response as the assistant_response
    // and generate a placeholder user_prompt
    return {
      user_prompt: '[Generated sample — see assistant_response]',
      assistant_response: cleaned,
    };
  }
}
