import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { benchmarkTest, hasExposedGc } from './BenchRunner.js';
import type { WorkerMessage } from './BenchRunner.js';
import { frameworkInfo, perfTests } from './TestConfigs.js';

/**
 * Benchmark one framework x scenario cell and print the outcome as a single JSON line on stdout.
 * `bench.ts` spawns one worker per cell, so engines never share a heap, JIT feedback, or
 * module-level state with each other or with earlier scenarios.
 */

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const { values } = parseArgs({
  options: {
    framework: { type: 'string' },
    scenario: { type: 'string' },
    repeats: { type: 'string' },
    quick: { type: 'boolean', default: false },
    record: { type: 'boolean', default: false },
  },
});

run().then(
  (message) => {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  },
  (error: unknown) => {
    const message: WorkerMessage = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    process.stdout.write(`${JSON.stringify(message)}\n`);
    process.exitCode = 1;
  },
);

async function run(): Promise<WorkerMessage> {
  const info = frameworkInfo.find((f) => f.id === values.framework);
  const config = perfTests.find((t) => t.name === values.scenario);
  if (!info || !config) {
    throw new Error(`unknown cell: framework '${values.framework}', scenario '${values.scenario}'`);
  }
  if (!hasExposedGc()) {
    console.warn('warning: worker started without --expose-gc; samples will not run gc() first');
  }

  const outcome = await benchmarkTest(config, info, {
    quick: values.quick,
    record: values.record,
    repeats: Number(values.repeats ?? '1'),
  });
  return { ok: true, outcome, entry: resolvedEntry(info.package) };
}

/** the engine file node resolves for a package, shortened to something readable */
function resolvedEntry(pkg: string): string {
  const path = fileURLToPath(import.meta.resolve(pkg));
  const marker = '/node_modules/';
  const at = path.lastIndexOf(marker);
  return at >= 0 ? path.slice(at + marker.length) : relative(repoRoot, path);
}
