import { PerformanceObserver, performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { makeGraph, runGraph } from './DependencyGraph.js';
import { summarize } from './Stats.js';
import type { Summary } from './Stats.js';
import type { FrameworkInfo, TestConfig } from './TestConfigs.js';

export interface TestResult {
  /** sum of all read leaf values over all iterations */
  sum: number;
  /** total number of computed-node executions */
  count: number;
  /** total number of effect executions */
  effects: number;
}

export interface TestTiming {
  /** wall clock time in milliseconds */
  time: number;
  /** garbage collection time during the sample, in milliseconds */
  gcTime: number;
}

export interface TimingResult<T> {
  result: T;
  timing: TestTiming;
}

export interface RunOptions {
  /** use tiny iteration counts for a fast smoke test; disables verification */
  quick: boolean;

  /** number of samples per framework x scenario; the median sample is reported */
  repeats: number;

  /** print recorded results instead of a table (for regenerating expected values) */
  record: boolean;
}

/** iteration count used in --quick mode */
export const QUICK_ITERATIONS = 10;

/** everything a benchmark produces for one framework x scenario cell */
export interface BenchmarkOutcome {
  samples: TimingResult<TestResult>[];
  summary: Summary;
}

/** the single JSON line a worker process prints for its cell */
export type WorkerMessage =
  | {
      ok: true;
      outcome: BenchmarkOutcome;
      /** the engine module that was actually loaded, to confirm production builds are in use */
      entry: string;
    }
  | { ok: false; error: string };

const gc = (globalThis as { gc?: () => void }).gc;

/**
 * Wait for queued `gc` performance entries to reach the observer. Node delivers them on a later
 * event-loop turn, never synchronously, so a fully synchronous sample loop would never see any.
 * One timer turn was enough in testing; the second is cheap insurance.
 */
async function drainGcEntries(): Promise<void> {
  await delay(0);
  await delay(0);
}

/**
 * Benchmark a single scenario for a single framework. The graph is built outside the timed
 * region, a warmup run gets the JIT going, then each sample writes one source and reads the
 * observed leaves for the configured number of iterations.
 */
export async function benchmarkTest(
  config: TestConfig,
  info: FrameworkInfo,
  options: RunOptions,
): Promise<BenchmarkOutcome> {
  const framework = await info.load();
  const iterations = options.quick ? QUICK_ITERATIONS : config.iterations;

  let gcTotal = 0;
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      gcTotal += entry.duration;
    }
  });
  observer.observe({ entryTypes: ['gc'] });

  const { graph, counter } = makeGraph(config, framework);

  function runOnce(): TestResult {
    const sum = runGraph(graph, iterations, framework);
    return { sum, count: counter.count, effects: counter.effects };
  }

  try {
    // warm up outside the timed samples so JIT compilation doesn't skew the first sample
    runOnce();

    const samples: TimingResult<TestResult>[] = [];
    for (let i = 0; i < options.repeats; i++) {
      counter.count = 0;
      counter.effects = 0;
      gc?.();
      // let the forced collection's entry arrive first, so it isn't charged to this sample
      await drainGcEntries();
      const gcBefore = gcTotal;
      const start = performance.now();
      const result = runOnce();
      const time = performance.now() - start;
      await drainGcEntries();
      samples.push({ result, timing: { time, gcTime: gcTotal - gcBefore } });
    }

    if (!options.quick && !options.record) {
      verifySamples(config, info, samples);
    }

    return { samples, summary: summarize(samples.map((s) => s.timing)) };
  } finally {
    observer.disconnect();
  }
}

/**
 * Verify every sample's sum and effect count, plus the computed-execution count for frameworks
 * with lazy pull semantics.
 */
function verifySamples(
  config: TestConfig,
  info: FrameworkInfo,
  samples: Array<TimingResult<TestResult>>,
): void {
  const expected = config.expected;
  if (!expected) {
    throw new Error(
      `scenario '${config.name}' has no expected values; run 'pnpm bench --record' and add them`,
    );
  }

  for (const sample of samples) {
    if (sample.result.sum !== expected.sum) {
      throw new Error(
        `sum check failed for ${info.name} '${config.name}': ` +
          `result ${sample.result.sum} expected ${expected.sum}`,
      );
    }
    if (sample.result.effects !== expected.effects) {
      throw new Error(
        `effect check failed for ${info.name} '${config.name}': ` +
          `result ${sample.result.effects} expected ${expected.effects}`,
      );
    }
    if (info.testPullCounts && expected.count > 0 && sample.result.count !== expected.count) {
      throw new Error(
        `count check failed for ${info.name} '${config.name}': ` +
          `result ${sample.result.count} expected ${expected.count}`,
      );
    }
  }
}

export function hasExposedGc(): boolean {
  return gc !== undefined;
}
