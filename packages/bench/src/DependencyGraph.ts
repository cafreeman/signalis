import type { TestConfig } from './TestConfigs.js';
import { pseudoRandom } from './PseudoRandom.js';
import type { Computed, ReactiveFramework, Signal } from './ReactiveFramework.js';

export interface Graph {
  sources: Signal<number>[];
  layers: Computed<number>[][];
  /** the leaves that get read on every iteration, and that carry effect observers */
  readLeaves: Computed<number>[];
}

export interface GraphAndCounter {
  graph: Graph;
  counter: Counter;
}

/** counts the total number of computed-node and effect executions */
export class Counter {
  count = 0;
  effects = 0;
}

/**
 * Make a rectangular dependency graph, with an equal number of source elements and computation
 * elements at every layer. The read fraction of leaves in the last layer carry effect observers
 * (the "active UI consumers"), so both push-based and pull-based engines do comparable work.
 *
 * @param config the scenario parameters
 * @param framework the reactive framework to build the graph with
 * @returns the graph and its execution counter
 */
export function makeGraph(config: TestConfig, framework: ReactiveFramework): GraphAndCounter {
  const { width, totalLayers, staticFraction, nSources, readFraction } = config;

  return framework.withBuild(() => {
    const sources = Array.from({ length: width }, (_, i) => framework.signal(i));
    const counter = new Counter();
    const layers = makeDependentRows(
      sources,
      totalLayers - 1,
      counter,
      staticFraction,
      nSources,
      framework,
    );

    const leaves = layers[layers.length - 1];
    const skipCount = Math.round(leaves.length * (1 - readFraction));
    const readLeaves = removeElems(leaves, skipCount, pseudoRandom());

    // attach an effect observer to each read leaf, so updates to unread leaves aren't the only
    // thing keeping push-based engines busy, and lazy engines still propagate to something.
    // Effect runs are counted so verification catches an adapter whose effects never fire: the
    // explicit leaf reads in runGraph would otherwise pull the same values and hide it.
    for (const leaf of readLeaves) {
      const l = leaf;
      framework.effect(() => {
        counter.effects++;
        l.read();
      });
    }

    return { graph: { sources, layers, readLeaves }, counter };
  });
}

/**
 * Execute the graph by writing one of the sources and reading the observed leaves, once per
 * iteration. The write happens inside the framework's batch wrapper.
 *
 * @return the sum of all read leaf values over all iterations, so verification covers every
 *   intermediate state rather than only the final one
 */
export function runGraph(graph: Graph, iterations: number, framework: ReactiveFramework): number {
  const { sources, readLeaves } = graph;

  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    framework.withBatch(() => {
      const sourceDex = i % sources.length;
      sources[sourceDex].write(i + sourceDex);
    });
    for (const leaf of readLeaves) {
      sum += leaf.read();
    }
  }
  return sum;
}

function removeElems<T>(src: T[], rmCount: number, rand: () => number): T[] {
  const copy = src.slice();
  for (let i = 0; i < rmCount; i++) {
    const rmDex = Math.floor(rand() * copy.length);
    copy.splice(rmDex, 1);
  }
  return copy;
}

function makeDependentRows(
  sources: Computed<number>[],
  numRows: number,
  counter: Counter,
  staticFraction: number,
  nSources: number,
  framework: ReactiveFramework,
): Computed<number>[][] {
  let prevRow = sources;
  const random = pseudoRandom();
  const rows = [];
  for (let l = 0; l < numRows; l++) {
    const row = makeRow(prevRow, counter, staticFraction, nSources, framework, random);
    rows.push(row);
    prevRow = row;
  }
  return rows;
}

function makeRow(
  sources: Computed<number>[],
  counter: Counter,
  staticFraction: number,
  nSources: number,
  framework: ReactiveFramework,
  random: () => number,
): Computed<number>[] {
  return sources.map((_, myDex) => {
    const mySources: Computed<number>[] = [];
    for (let sourceDex = 0; sourceDex < nSources; sourceDex++) {
      mySources.push(sources[(myDex + sourceDex) % sources.length]);
    }

    const staticNode = random() < staticFraction;
    if (staticNode) {
      // static node, always references the same sources
      return framework.computed(() => {
        counter.count++;

        let sum = 0;
        for (const src of mySources) {
          sum += src.read();
        }
        return sum;
      });
    } else {
      // dynamic node, drops one of the sources depending on the parity of the first element
      const first = mySources[0];
      const tail = mySources.slice(1);
      return framework.computed(() => {
        counter.count++;
        let sum = first.read();
        const shouldDrop = sum & 0x1;
        const dropDex = sum % tail.length;

        for (let i = 0; i < tail.length; i++) {
          if (shouldDrop && i === dropDex) continue;
          sum += tail[i].read();
        }

        return sum;
      });
    }
  });
}
