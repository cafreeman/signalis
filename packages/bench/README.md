# @signalis/bench

Graph-based benchmark that measures signalis against other standalone signal libraries. The
harness is ported from the approach used by the
[reactively](https://github.com/modderme123/reactively) benchmark suite, modernized to compare
against current engines.

This package is private: it is never published to npm (`private: true` here plus the `ignore`
entry in `.changeset/config.json` keep it out of releases).

## Run

```bash
pnpm bench                          # all frameworks, all scenarios
pnpm bench --quick                  # smoke run: tiny iteration counts, no verification
pnpm bench --framework signalis     # a subset, comma separated
pnpm bench --scenario "deep,wide dense"  # quote names that contain spaces
pnpm bench --repeats 20             # more samples; the median is reported
pnpm bench --no-quick               # override `quick: true` from the config file
pnpm bench --output results/m1      # write to a named path instead of the archive
pnpm bench --config bench.local.toml
pnpm bench --list                   # print framework and scenario ids
```

Use the `bench` script rather than invoking `src/bench.ts` directly: it rebuilds `@signalis/core`
first (the benchmark imports core's `dist/`, so a stale build would silently measure old code),
and the orchestrator spawns its workers with the node flags they need.

## Configuration

`packages/bench/bench.config.toml` provides defaults for every flag. CLI flags override the
config file, and the config file overrides the built-in defaults.

| key         | type               | default | maps to       | meaning                              |
| ----------- | ------------------ | ------- | ------------- | ------------------------------------ |
| `quick`     | boolean            | `false` | `--quick`     | smoke mode (see methodology below)   |
| `repeats`   | positive integer   | `10`    | `--repeats`   | samples per framework x scenario     |
| `framework` | string or string[] | (all)   | `--framework` | engines to run, comma separated      |
| `scenario`  | string or string[] | (all)   | `--scenario`  | scenarios to run, comma separated    |
| `output`    | string             | (none)  | `--output`    | write results to this prefix instead |

The checked-in file lists every scenario and every framework except `tc39`, which is commented out
so a plain `pnpm bench` skips it. Because that isn't every registered framework, such a run doesn't
refresh `results/latest.*`; uncomment `tc39` (or pass `--framework` with all six ids) for a run that
does. When you add a framework or scenario, add it to the file too, or a plain `pnpm bench` will
skip it. `--record` ignores the config's `repeats` and takes one
sample per cell unless `--repeats` is passed. Omit a key (or comment it out) for "not set". For multi-value keys, `["signalis", "alien"]` and `"signalis,alien"`
are equivalent. `--list` and `--record` are one-shot CLI actions and are not configurable.
`--config <path>` points at a different config file, which must exist; it is resolved relative
to the current working directory.

## Output

Every run except `--record` and `--list` writes its results to disk in
`packages/bench/results/`:

- `<timestamp>.json` and `<timestamp>.md`: a timestamped archive of that run. The JSON holds
  the environment (node, platform, CPU, engine versions), the resolved run configuration, and
  per-cell records with a summary (median, min, max, median gc time) and every sample's time,
  gc time, sum, computed-execution count, and effect-execution count. It also records the
  module each engine actually loaded (`entries`), so a dev build sneaking in is visible. The
  Markdown is a human-readable table of the same run.
- `latest.json` and `latest.md`: refreshed only by a full run (all frameworks, all scenarios,
  not quick), so tooling and run-over-run diffs always have a stable path. Filtered or quick
  runs never touch them.
- With `--output <prefix>` (or a config `output`), only `<prefix>.json` and `<prefix>.md` are
  written, resolved relative to the current working directory.

`results/` is gitignored: benchmark numbers are machine- and run-specific, so committed results
would be misleading. Keep local history, or copy a run into an issue or PR when it matters.

## Frameworks

| id       | engine                                             |
| -------- | -------------------------------------------------- |
| signalis | `@signalis/core`                                   |
| solid    | `@solidjs/signals` (Solid 2.0 RC)                  |
| preact   | `@preact/signals-core`                             |
| vue      | `@vue/reactivity`                                  |
| alien    | `alien-signals`                                    |
| tc39     | `signal-polyfill` (TC39 Signals proposal polyfill) |

Add a framework by implementing the `ReactiveFramework` interface in
`src/frameworks/`, registering it in `src/TestConfigs.ts`, and adding the package as a
devDependency.

## Methodology

Each scenario builds a rectangular dependency graph: mutable signals in the first layer, computed
nodes in the middle layers (each summing `nSources` nodes from the layer above; `staticFraction`
of them read a dynamic subset of their sources instead), and effect-observed leaves in the last
layer. Each iteration writes one source inside the framework's batch wrapper, then reads the
`readFraction` of leaves that carry effect observers.

- Every framework x scenario cell runs in its own node process (`src/worker.ts`), so engines
  never share a heap, JIT feedback, or module-level state with another engine or an earlier
  scenario, and run order doesn't matter.
- Workers run with `--conditions=production` and `NODE_ENV=production`, so engines that ship
  separate dev builds (`@vue/reactivity`) load their production build, as in a real app bundle.
- Graph construction is outside the timed region. One warmup run precedes sampling.
- Each sample is timed with `performance.now()`. The **median** of `--repeats` samples (default 10) is the headline number, reported in milliseconds with the fastest and slowest sample
  alongside. Differences smaller than the min/max spread are noise.
- `globalThis.gc()` runs before each sample (workers start with `--expose-gc`), and a
  `PerformanceObserver` for `gc` entries reports how much of each sample was spent collecting.
  Node delivers those entries on a later event-loop turn, so the runner yields to the event loop
  after the forced collection (so it isn't charged to the sample) and again after the sample.
- Every sample verifies, against values recorded in `src/TestConfigs.ts`:
  - the sum of every read leaf value over every iteration, so each intermediate state is
    checked, not just the final one;
  - the number of effect executions, for every engine, so an adapter whose effects never fire
    fails (the explicit leaf reads would otherwise hide it);
  - the number of computed executions, for engines with lazy pull semantics
    (`testPullCounts`). Solid's memos are eager and run more computeds on partial-read
    scenarios, so its count isn't checked; the Markdown report's `computeds` column shows it.

  Failures throw, are reported, and set a nonzero exit code.

- Scenario shapes are deterministic (`PseudoRandom` is seeded), so every framework builds and
  reads exactly the same graph on every run.
- Quick mode (`--quick`) runs 10 iterations per scenario for a fast smoke test. Expected sums are
  only valid for full iteration counts, so verification is disabled in quick mode, and quick
  timings are not meaningful: with iteration counts at or below the graph width, each sample
  after the first rewrites values that are already there, so most writes are no-ops.

### Recording expected values

Scenario parameters come from the reactively suite; expected sums and counts are recorded from
real runs, cross-checked across engines that agree, so no engine is the reference for its own
correctness:

```bash
pnpm bench --record
```

`--record` runs full iteration counts once per scenario and prints `expected` blocks. If the
engines agree on the sum, the effect count, and (among `testPullCounts` engines) the computed
count, paste the block into the scenario in `src/TestConfigs.ts`. Engines that disagree are listed
per framework so you can investigate the difference. A `count` of `0` disables the count check for
that scenario.

## Caveats

- Each iteration makes exactly one write per batch, so the suite barely exercises batching. Engines
  without a batch primitive (Vue's standalone reactivity) aren't penalized here the way they
  would be by workloads that write several signals at once.
- Sums in the larger scenarios exceed 2^53, so they're compared as floating-point values. That's
  still exact for verification: every engine sums the same values in the same order.
- These are plain number graphs. Proxy-based stores, scheduling differences under async
  boundaries, and real application workloads can behave differently.
- Benchmark numbers are machine- and run-specific. Compare engines from the same run only.
