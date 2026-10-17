import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadBenchConfig } from './BenchConfig.js';
import type { RunOptions, WorkerMessage } from './BenchRunner.js';
import { logPerfFailure, logPerfResult, logPerfResultHeaders } from './PerfLogging.js';
import { buildRunMeta, okRecord, writeRun } from './ResultsFile.js';
import type { ScenarioRecord } from './ResultsFile.js';
import { frameworkInfo, perfTests } from './TestConfigs.js';
import type { FrameworkInfo, TestConfig } from './TestConfigs.js';

interface RecordEntry {
  id: string;
  framework: string;
  test: string;
  sum: number;
  count: number;
  effects: number;
  /** whether this engine's computed count is comparable (see `FrameworkInfo.testPullCounts`) */
  pullCounts: boolean;
}

const DEFAULT_REPEATS = 10;

const optionDefinitions = {
  quick: { type: 'boolean' },
  list: { type: 'boolean', default: false },
  record: { type: 'boolean', default: false },
  repeats: { type: 'string' },
  framework: { type: 'string' },
  scenario: { type: 'string' },
  output: { type: 'string' },
  config: { type: 'string' },
} as const;

const packageDir = fileURLToPath(new URL('../', import.meta.url));
const workerPath = fileURLToPath(new URL('./worker.ts', import.meta.url));

/**
 * Node flags for every worker. Production conditions plus NODE_ENV=production make engines that
 * ship separate dev builds (e.g. `@vue/reactivity`) load their production build, as they would in
 * a real app bundle.
 */
const workerExecArgv = ['--expose-gc', '--conditions=production', '--import', 'tsx'];

try {
  main();
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

function main(): void {
  const startedAt = new Date();
  // allowNegative lets `--no-quick` override `quick: true` from the config file
  const { values } = parseArgs({ options: optionDefinitions, allowNegative: true });

  // CLI flags override the config file, which overrides the built-in defaults
  const { config: benchConfig, path: configPath } = loadBenchConfig(values.config);

  const quick = values.quick ?? benchConfig.quick ?? false;
  const record = values.record;
  // --record needs one sample per cell, so the config's repeats only applies to timed runs
  const repeats = parseRepeats(
    values.repeats ?? (record ? undefined : benchConfig.repeats),
    record,
  );
  const frameworkArg = values.framework ?? benchConfig.framework;
  const scenarioArg = values.scenario ?? benchConfig.scenario;
  const outputArg = values.output ?? benchConfig.output;

  if (values.list) {
    console.log('frameworks:');
    for (const f of frameworkInfo) {
      console.log(`  ${f.id.padEnd(10)} ${f.framework.name}`);
    }
    console.log('scenarios:');
    for (const t of perfTests) {
      console.log(`  ${t.name}`);
    }
    return;
  }

  const frameworks = filterByFlag(
    frameworkInfo.map((f) => f.id),
    frameworkArg,
  );
  const scenarios = filterByFlag(
    perfTests.map((t) => t.name),
    scenarioArg,
  );

  const options: RunOptions = { quick, record, repeats };

  console.log(
    `bench: ${frameworks.length} framework(s) x ${scenarios.length} scenario(s), ` +
      `repeats=${repeats}, one process per cell` +
      `${quick ? ' (quick mode: verification off)' : ''}` +
      (configPath ? `\nconfig: ${configPath}` : ''),
  );

  const results: ScenarioRecord[] = [];
  const recorded: RecordEntry[] = [];
  const entries: Record<string, string> = {};
  let failures = 0;

  logPerfResultHeaders();

  for (const info of frameworkInfo) {
    if (!frameworks.includes(info.id)) continue;

    for (const scenarioConfig of perfTests) {
      if (!scenarios.includes(scenarioConfig.name)) continue;

      if (info.skipTests?.includes(scenarioConfig.name)) {
        console.log(`${info.framework.name} skips '${scenarioConfig.name}'`);
        results.push(skipRecord(scenarioConfig, info, 'skipped for this framework'));
        continue;
      }

      const message = runCell(info, scenarioConfig, options);
      if (!message.ok) {
        failures++;
        logPerfFailure(scenarioConfig, info, message.error);
        results.push(failRecord(scenarioConfig, info, message.error));
        continue;
      }

      const { outcome } = message;
      entries[info.id] = message.entry;
      logPerfResult(scenarioConfig, info, outcome, options);
      const first = outcome.samples[0];
      if (record && first) {
        recorded.push({
          id: info.id,
          framework: info.framework.name,
          test: scenarioConfig.name,
          ...first.result,
          pullCounts: info.testPullCounts ?? false,
        });
      }
      results.push(okRecord(scenarioConfig, info, outcome));
    }
  }

  if (record) {
    // record mode is for regenerating constants: its output goes to stdout, not result files
    printRecorded(recorded);
  } else {
    const meta = buildRunMeta({ startedAt, quick, repeats, frameworks, scenarios, entries });
    const written = writeRun({ meta, results }, outputArg);
    console.log(`\nwrote:\n${written.map((file) => `  ${file}`).join('\n')}`);
  }

  process.exitCode = failures > 0 ? 1 : 0;
}

/**
 * Benchmark one framework x scenario cell in a fresh node process, so no engine inherits heap
 * state, JIT feedback, or module-level state from another engine or an earlier scenario. The
 * worker's stderr passes through; its last stdout line is the JSON result.
 */
function runCell(info: FrameworkInfo, config: TestConfig, options: RunOptions): WorkerMessage {
  const args = [
    '--framework',
    info.id,
    '--scenario',
    config.name,
    '--repeats',
    `${options.repeats}`,
  ];
  if (options.quick) args.push('--quick');
  if (options.record) args.push('--record');

  const child = spawnSync(process.execPath, [...workerExecArgv, workerPath, ...args], {
    cwd: packageDir,
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  if (child.error) {
    return { ok: false, error: `could not start worker: ${child.error.message}` };
  }

  const lastLine = child.stdout.trimEnd().split('\n').pop() ?? '';
  try {
    return JSON.parse(lastLine) as WorkerMessage;
  } catch {
    return { ok: false, error: `worker exited with code ${child.status} without a result` };
  }
}

function parseRepeats(value: string | number | undefined, isRecord: boolean): number {
  if (value === undefined) {
    return isRecord ? 1 : DEFAULT_REPEATS;
  }
  if (typeof value === 'number') {
    return value; // validated by the config loader
  }
  const parsed = /^\d+$/.test(value) ? Number.parseInt(value, 10) : Number.NaN;
  if (parsed > 0) {
    return parsed;
  }
  throw new Error(`--repeats must be a positive integer, got '${value}'`);
}

function filterByFlag(all: string[], flag: string | undefined): string[] {
  if (flag === undefined) {
    return all;
  }
  const wanted = flag
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  const selected = all.filter((name) => wanted.includes(name.toLowerCase()));
  const unknown = wanted.filter((w) => !all.some((name) => name.toLowerCase() === w));
  if (unknown.length > 0) {
    throw new Error(`unknown option value(s): ${unknown.join(', ')}. Use --list to see options`);
  }
  return selected;
}

function skipRecord(config: TestConfig, info: FrameworkInfo, reason: string): ScenarioRecord {
  return {
    framework: info.framework.name,
    id: info.id,
    scenario: config.name,
    status: 'skip',
    config: {
      width: config.width,
      totalLayers: config.totalLayers,
      staticFraction: config.staticFraction,
      nSources: config.nSources,
      readFraction: config.readFraction,
      iterations: config.iterations,
    },
    samples: [],
    reason,
  };
}

function failRecord(config: TestConfig, info: FrameworkInfo, message: string): ScenarioRecord {
  return {
    framework: info.framework.name,
    id: info.id,
    scenario: config.name,
    status: 'fail',
    config: {
      width: config.width,
      totalLayers: config.totalLayers,
      staticFraction: config.staticFraction,
      nSources: config.nSources,
      readFraction: config.readFraction,
      iterations: config.iterations,
    },
    samples: [],
    failure: message,
  };
}

function printRecorded(entries: RecordEntry[]): void {
  console.log('\nrecorded values, by scenario:');
  for (const config of perfTests) {
    const forScenario = entries.filter((e) => e.test === config.name);
    // the expected count comes from engines whose counts are comparable; with none, it's 0 (off)
    const reference = forScenario.find((e) => e.pullCounts) ?? forScenario[0];
    if (!reference) continue;

    const agree = forScenario.every(
      (e) =>
        e.sum === reference.sum &&
        e.effects === reference.effects &&
        (!e.pullCounts || e.count === reference.count),
    );
    const expectedCount = reference.pullCounts ? reference.count : 0;

    if (agree) {
      console.log(
        `  ${config.name}: expected: { sum: ${reference.sum}, count: ${expectedCount}, ` +
          `effects: ${reference.effects} },`,
      );
    } else {
      console.log(`  ${config.name}: frameworks disagree, pick a reference engine:`);
      for (const e of forScenario) {
        console.log(
          `    ${e.framework} (${e.id}): { sum: ${e.sum}, count: ${e.count}, effects: ${e.effects} }`,
        );
      }
    }
  }
}
