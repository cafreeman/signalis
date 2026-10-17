import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameworkInfo, perfTests } from './TestConfigs.js';
import type { FrameworkInfo, TestConfig } from './TestConfigs.js';
import type { BenchmarkOutcome, TestResult, TimingResult } from './BenchRunner.js';
import { QUICK_ITERATIONS } from './BenchRunner.js';
import type { Summary } from './Stats.js';

/** one timed sample of a framework x scenario cell */
export interface SampleRecord {
  time: number;
  gcTime: number;
  sum: number;
  count: number;
  effects: number;
}

/** the record for one framework x scenario cell */
export interface ScenarioRecord {
  framework: string;
  id: string;
  scenario: string;
  status: 'ok' | 'fail' | 'skip';
  config: {
    width: number;
    totalLayers: number;
    staticFraction: number;
    nSources: number;
    readFraction: number;
    iterations: number;
  };
  samples: SampleRecord[];
  summary?: Summary;
  failure?: string;
  reason?: string;
}

export interface RunMeta {
  timestamp: string;
  quick: boolean;
  repeats: number;
  frameworks: string[];
  scenarios: string[];
  node: string;
  platform: string;
  cpu: string;
  engines: Record<string, string>;
  /** the engine module each worker actually loaded, e.g. to confirm production builds */
  entries: Record<string, string>;
}

export interface BenchRun {
  meta: RunMeta;
  results: ScenarioRecord[];
}

/** default results directory, anchored to this package regardless of cwd */
const resultsDir = fileURLToPath(new URL('../results/', import.meta.url));

export function buildRunMeta(args: {
  startedAt: Date;
  quick: boolean;
  repeats: number;
  frameworks: string[];
  scenarios: string[];
  entries: Record<string, string>;
}): RunMeta {
  return {
    timestamp: args.startedAt.toISOString(),
    quick: args.quick,
    repeats: args.repeats,
    frameworks: args.frameworks,
    scenarios: args.scenarios,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cpu: cpus()[0]?.model ?? 'unknown',
    engines: engineVersions(args.frameworks),
    entries: args.entries,
  };
}

/**
 * Write a run's results to disk. A timestamped JSON + Markdown archive is always written; a
 * full run (every framework, every scenario, not quick, no failed cells) also refreshes `latest.json` and
 * `latest.md` so tooling has a stable path. An explicit output prefix writes only
 * `<prefix>.json` and `<prefix>.md`.
 *
 * @returns the list of files written
 */
export function writeRun(run: BenchRun, outputPrefix?: string): string[] {
  const json = `${JSON.stringify(run, null, 2)}\n`;
  const md = markdownReport(run);

  if (outputPrefix) {
    const prefix = resolve(process.cwd(), outputPrefix);
    return [writeFile(`${prefix}.json`, json), writeFile(`${prefix}.md`, md)];
  }

  const stamp = timestampSlug(run.meta.timestamp);
  const written = [
    writeFile(join(resultsDir, `${stamp}.json`), json),
    writeFile(join(resultsDir, `${stamp}.md`), md),
  ];

  if (isFullRun(run)) {
    written.push(
      writeFile(join(resultsDir, 'latest.json'), json),
      writeFile(join(resultsDir, 'latest.md'), md),
    );
  }

  return written;
}

export function okRecord(
  config: TestConfig,
  info: FrameworkInfo,
  outcome: BenchmarkOutcome,
): ScenarioRecord {
  return {
    framework: info.name,
    id: info.id,
    scenario: config.name,
    status: 'ok',
    config: scenarioShape(config),
    samples: outcome.samples.map(toSampleRecord),
    summary: outcome.summary,
  };
}

function toSampleRecord(timed: TimingResult<TestResult>): SampleRecord {
  return {
    time: timed.timing.time,
    gcTime: timed.timing.gcTime,
    sum: timed.result.sum,
    count: timed.result.count,
    effects: timed.result.effects,
  };
}

function scenarioShape(config: TestConfig): ScenarioRecord['config'] {
  return {
    width: config.width,
    totalLayers: config.totalLayers,
    staticFraction: config.staticFraction,
    nSources: config.nSources,
    readFraction: config.readFraction,
    iterations: config.iterations,
  };
}

function writeFile(path: string, contents: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

function isFullRun(run: BenchRun): boolean {
  return (
    !run.meta.quick &&
    run.meta.frameworks.length === frameworkInfo.length &&
    run.meta.scenarios.length === perfTests.length &&
    run.results.every((r) => r.status !== 'fail')
  );
}

function timestampSlug(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

function engineVersions(ids: string[]): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const info of frameworkInfo) {
    if (!ids.includes(info.id)) {
      continue;
    }
    versions[info.id] = `${info.package}@${installedVersion(info.package)}`;
  }
  return versions;
}

function installedVersion(pkg: string): string {
  try {
    const manifestUrl = new URL(`../node_modules/${pkg}/package.json`, import.meta.url);
    const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8')) as { version?: string };
    return manifest.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function ms(n: number | undefined): string {
  return n === undefined ? '-' : n.toFixed(2);
}

function markdownReport(run: BenchRun): string {
  const { meta } = run;
  const lines: string[] = [
    `# Bench run ${meta.timestamp}`,
    '',
    `- node: ${meta.node} (${meta.platform}), ${meta.cpu}`,
    `- frameworks: ${meta.frameworks.join(', ')}`,
    `- scenarios: ${meta.scenarios.join(', ')}`,
    `- repeats: ${meta.repeats}${meta.quick ? ' (quick mode: timings are not meaningful)' : ''}`,
    `- engines: ${Object.entries(meta.engines)
      .map(([id, version]) => `${id}=${version}`)
      .join(', ')}`,
    `- entries: ${Object.entries(meta.entries)
      .map(([id, entry]) => `${id}=${entry}`)
      .join(', ')}`,
    '- times are the median of all samples, with the fastest and slowest sample alongside',
    '- computeds: computed executions per sample; engines that do more work show it here',
    '',
    '| framework | scenario | size | iterations | median (ms) | min (ms) | max (ms) | gc (ms) | computeds | status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const result of run.results) {
    const summary = result.status === 'ok' ? result.summary : undefined;
    const computeds = result.status === 'ok' ? `${result.samples[0]?.count ?? '-'}` : '-';
    const iterations = run.meta.quick ? QUICK_ITERATIONS : result.config.iterations;
    lines.push(
      `| ${result.framework} | ${result.scenario} | ${result.config.width}x${result.config.totalLayers}` +
        ` | ${iterations} | ${ms(summary?.median)} | ${ms(summary?.min)} | ${ms(summary?.max)}` +
        ` | ${ms(summary?.gcMedian)} | ${computeds} | ${result.status} |`,
    );
  }

  const failed = run.results.filter((r) => r.status === 'fail');
  if (failed.length > 0) {
    lines.push('', '## Failures', '');
    for (const failure of failed) {
      lines.push(`- ${failure.framework} '${failure.scenario}': ${failure.failure}`);
    }
  }

  const skipped = run.results.filter((r) => r.status === 'skip');
  if (skipped.length > 0) {
    lines.push('', '## Skips', '');
    for (const skip of skipped) {
      lines.push(`- ${skip.framework} '${skip.scenario}': ${skip.reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
