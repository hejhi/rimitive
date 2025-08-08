# @lattice/benchmarks

Benchmarks for Lattice signals and related libraries.

## Quick Start

- Run all benches (builds workspaces first):
  - `pnpm --filter @lattice/benchmarks bench:dev`
 
- Node flags recommended for memory-oriented benches:
  - `node --expose-gc` (already used by `bench` script)

## Suites

- Signals comparison: single updates, chains, diamonds, deep graphs, batching, effects.
- Push–pull scenarios: filtered diamonds, multi-level filtering, conditional deps, sparse updates, write-heavy vs read-heavy.
- Propagation patterns: grid/chain propagation and complex object updates.
- Memory usage: creation, deep trees, cleanup efficiency, bulk create/dispose.
- Subscription throughput: effects scaling when only a fraction of sources change.

## Interpreting Results

- Subscription throughput should scale with the number of subscribers whose selected values actually change; unchanged paths should avoid callbacks.

## Caveats

- Benchmarks run with Vitest Bench and are microbenchmarks; validate with your app patterns.
- For memory measurements, prefer the `bench` script which runs Node with `--expose-gc`.
- Some suites intentionally measure steady-state performance (warm), others include cold-init cost; refer to each suite's comments.
