import type { TestTiming } from './BenchRunner.js';

/** summary statistics over the samples of one framework x scenario cell, in milliseconds */
export interface Summary {
  median: number;
  min: number;
  max: number;
  gcMedian: number;
}

function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Summarize a cell's samples. The median is the headline number: it's robust to the occasional
 * slow sample (a GC pause, a scheduler hiccup) without hiding a consistently slow engine the way
 * the minimum can. Min and max show the spread, so close results can be judged against noise.
 */
export function summarize(timings: TestTiming[]): Summary {
  const times = timings.map((t) => t.time);
  return {
    median: median(times),
    min: Math.min(...times),
    max: Math.max(...times),
    gcMedian: median(timings.map((t) => t.gcTime)),
  };
}
