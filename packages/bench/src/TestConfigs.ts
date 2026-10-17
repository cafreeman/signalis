import { alienFramework } from './frameworks/AlienSignalsFramework.js';
import { preactSignalFramework } from './frameworks/PreactSignalFramework.js';
import { signalisFramework } from './frameworks/SignalisFramework.js';
import { solidFramework } from './frameworks/SolidSignalsFramework.js';
import { tc39Framework } from './frameworks/Tc39PolyfillFramework.js';
import { vueFramework } from './frameworks/VueReactivityFramework.js';
import type { ReactiveFramework } from './ReactiveFramework.js';

/** Parameters for running a performance benchmark scenario.
 *
 * The scenarios build a rectangular grid of reactive elements, with mutable signals in the
 * first layer, computed elements in the middle layers, and effect-observed leaves in the last
 * layer. Each iteration modifies one signal, then reads the read fraction of the leaves.
 *
 * Each non-signal node sums values from a specified number of elements in the preceding layer.
 * Some nodes are dynamic, and vary the number of sources they read for the sum.
 */
export interface TestConfig {
  /** friendly name for the scenario, should be unique */
  name: string;

  /** width of dependency graph to construct */
  width: number;

  /** total number of source and computed layers */
  totalLayers: number;

  /** fraction of nodes that are static */
  staticFraction: number;

  /** number of sources in each computed node */
  nSources: number;

  /** fraction of leaves in the last layer that are read (and observed) in each iteration */
  readFraction: number;

  /** number of test iterations */
  iterations: number;

  /** sum, computed-execution count, and effect-execution count over all iterations, for
   * verification. `count` of `0` skips the count check. Regenerate with `pnpm bench --record`
   * across several engines and only accept values they all agree on (see the README), so no
   * single engine is the reference for its own correctness. */
  expected?: ExpectedValues;
}

export interface ExpectedValues {
  sum: number;
  count: number;
  effects: number;
}

export interface FrameworkInfo {
  /** short CLI identifier for the framework */
  id: string;

  /** npm package implementing the engine, recorded in result files */
  package: string;

  /** wrapper/adapter for benchmarking a reactive framework */
  framework: ReactiveFramework;

  /** list of scenario names to always skip for this framework (e.g. for known bugs) */
  skipTests?: string[];

  /** verify that the number of computed executions matches the expected count (sums and effect
   * counts are verified for every framework) */
  testPullCounts?: boolean;
}

export const frameworkInfo: FrameworkInfo[] = [
  {
    id: 'signalis',
    package: '@signalis/core',
    framework: signalisFramework,
    testPullCounts: true,
  },
  // solid eagerly refreshes memos during batch, including leaves that are never read, so its
  // computed counts don't match the lazy engines' on partial-read scenarios. That extra work is
  // real and is timed; its sums and effect counts are still verified.
  { id: 'solid', package: '@solidjs/signals', framework: solidFramework },
  {
    id: 'preact',
    package: '@preact/signals-core',
    framework: preactSignalFramework,
    testPullCounts: true,
  },
  { id: 'vue', package: '@vue/reactivity', framework: vueFramework, testPullCounts: true },
  { id: 'alien', package: 'alien-signals', framework: alienFramework, testPullCounts: true },
  { id: 'tc39', package: 'signal-polyfill', framework: tc39Framework, testPullCounts: true },
];

export const perfTests: TestConfig[] = [
  {
    name: 'simple component',
    width: 10,
    totalLayers: 5,
    staticFraction: 1,
    nSources: 2,
    readFraction: 0.2,
    iterations: 600000,
    expected: { sum: 5760076800000, count: 3480000, effects: 600000 },
  },
  {
    name: 'dynamic component',
    width: 10,
    totalLayers: 10,
    staticFraction: 3 / 4,
    nSources: 6,
    readFraction: 0.2,
    iterations: 15000,
    expected: { sum: 2268691797300000, count: 1155000, effects: 30000 },
  },
  {
    name: 'large web app',
    width: 1000,
    totalLayers: 12,
    staticFraction: 0.95,
    nSources: 4,
    readFraction: 1,
    iterations: 7000,
    expected: { sum: 117411151872000670, count: 1463000, effects: 238000 },
  },
  {
    name: 'wide dense',
    width: 1000,
    totalLayers: 5,
    staticFraction: 1,
    nSources: 25,
    readFraction: 1,
    iterations: 3000,
    expected: { sum: 2342578125000000, count: 732000, effects: 291000 },
  },
  {
    name: 'deep',
    width: 5,
    totalLayers: 500,
    staticFraction: 1,
    nSources: 3,
    readFraction: 1,
    iterations: 500,
    expected: { sum: 7.62051115555107e243, count: 1246500, effects: 2500 },
  },
  {
    name: 'very dynamic',
    width: 100,
    totalLayers: 15,
    staticFraction: 0.5,
    nSources: 6,
    readFraction: 1,
    iterations: 2000,
    expected: { sum: 16440801627340810000, count: 1078000, effects: 142000 },
  },
];
