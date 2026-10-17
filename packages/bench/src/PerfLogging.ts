import type { FrameworkInfo, TestConfig } from './TestConfigs.js';
import { QUICK_ITERATIONS, type BenchmarkOutcome, type RunOptions } from './BenchRunner.js';

interface PerfRow {
  framework: string;
  test: string;
  size: string;
  'read%': string;
  'static%': string;
  nTimes: string;
  median: string;
  min: string;
  max: string;
  gcTime: string;
  status: string;
}

const columnWidth: Record<keyof PerfRow, number> = {
  framework: 18,
  test: 18,
  size: 8,
  'read%': 5,
  'static%': 7,
  nTimes: 7,
  median: 10,
  min: 10,
  max: 10,
  gcTime: 8,
  status: 8,
};

export function logPerfResultHeaders(): void {
  logRow(perfHeaders());
}

export function logPerfResult(
  config: TestConfig,
  info: FrameworkInfo,
  outcome: BenchmarkOutcome,
  options: RunOptions,
): void {
  const { summary } = outcome;
  const iterations = options.quick ? QUICK_ITERATIONS : config.iterations;
  const row: PerfRow = {
    framework: info.name,
    test: config.name,
    size: `${config.width}x${config.totalLayers}`,
    'read%': percent(config.readFraction),
    'static%': percent(config.staticFraction),
    nTimes: `${iterations}`,
    median: `${summary.median.toFixed(2)}ms`,
    min: `${summary.min.toFixed(2)}ms`,
    max: `${summary.max.toFixed(2)}ms`,
    gcTime: `${summary.gcMedian.toFixed(2)}ms`,
    status: options.quick ? 'quick' : 'ok',
  };
  logRow(row);

  const first = outcome.samples[0];
  if (options.record && first) {
    console.log(
      `  record: { framework: '${info.id}', test: '${config.name}', ` +
        `sum: ${first.result.sum}, count: ${first.result.count}, effects: ${first.result.effects} }`,
    );
  }
}

export function logPerfFailure(config: TestConfig, info: FrameworkInfo, message: string): void {
  const row: PerfRow = {
    framework: info.name,
    test: config.name,
    size: `${config.width}x${config.totalLayers}`,
    'read%': percent(config.readFraction),
    'static%': percent(config.staticFraction),
    nTimes: '-',
    median: '-',
    min: '-',
    max: '-',
    gcTime: '-',
    status: 'FAIL',
  };
  logRow(row);
  console.log(`  ${message}`);
}

function perfHeaders(): PerfRow {
  const row = {} as PerfRow;
  for (const key of Object.keys(columnWidth) as Array<keyof PerfRow>) {
    row[key] = key;
  }
  return row;
}

function logRow(row: PerfRow): void {
  const line = (Object.keys(columnWidth) as Array<keyof PerfRow>)
    .map((key) => row[key].slice(0, columnWidth[key]).padEnd(columnWidth[key]))
    .join(' ');
  console.log(line);
}

function percent(n: number): string {
  return `${Math.round(n * 100)}%`;
}
