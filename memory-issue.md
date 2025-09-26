# Benchmark Memory Issues

## Benchmarks, Set 1

Lattice appears to have memory performance issues in the following benchmarks (the below excerpts memory usage only, and just between alien-signals and lattice for simplicity—preact scales similarly to alien, with no issues, but lattice is closer to alien in terms of implementation):

### `computed-diamond-simple`

Lattice  3.82 mb  ▆███▆█▆██▁█▆▆▆█▆▁▆█▁█
Alien    895.42 b ▃▁▁▁▇▅████▅▇▅▅▃▁▁▁▃▃▅

### `scaling-subscribers`

Lattice - 10 subscribers   1.09 mb  ▁███▄▅▃▂▆██▂▂▁▁▁▁▁▁▁▁
Lattice - 25 subscribers   4.58 mb  ▂▇██▇▇▄▇▃▁▂▂▃▄▃▄▇▂▂█▂
Lattice - 50 subscribers   13.22 mb ████▆█▁█▆▁▁▆▁▆▁█▆▁▆▁▆
Lattice - 100 subscribers  37.77 mb ███▁▁▁▁███▁▁▁▁▁▁█▁▁▁█
Lattice - 200 subscribers  43.37 mb █▁▁█▁▁▁███▁█▁███▁▁▁▁█

Alien - 10 subscribers     3.29 kb  ▁▁▃▃██▂▃▃▆██▆▆▃▃▃▂▂▂▁
Alien - 25 subscribers     1.39 kb  ▃▂█████▅▄▃▂▂▅▂▆█▃▂▂▃▃
Alien - 50 subscribers     408.00 b █████▁████▄▄▁█▄▁▁▁▄▁▄
Alien - 100 subscribers    408.00 b █▁▁▁██▁▁█▁▁▁██▁▁▁▁█▁█
Alien - 200 subscribers    408.00 b ██▁███▁▁▁▁█▁█▁▁▁█▁▁▁█

### `scaling-computed-computed`

Lattice - 10 subscribers  1.26 mb   ██▆▄▂▂▂▃▁▂▁▁▂▂▁▁▂▂▁▁▁
Lattice - 25 subscribers  4.85 mb   ████▇██████████▃▇▃▅▁▃
Lattice - 50 subscribers  13.60 mb  ████▇██▇▁▁█▁▇█▁▁█▁█▁▇
Lattice - 100 subscribers 38.30 mb  █▁▁██▁▁▁▁█▁█▁▁█▁▁█▁▁█
Lattice - 200 subscribers 44.12 mb  █▁▁█▁█▁▁██▁█▁▁▁▁█▁█▁█

Alien - 10 subscribers    175.80 kb ██▆▄█▆▄▃▂▂▁▁▁▂▂▁▁▁▁▁▁
Alien - 25 subscribers    273.85 kb ███▅▂▆▂▄▂▃▂▃▁▁▁▂▂▁▂▁▂
Alien - 50 subscribers    387.19 kb ▇█▇█▇▁▇▇▇█▇▇▁▇▇██▇▇▇█
Alien - 100 subscribers   547.34 kb ██▁█▁▁██▁▁▁▁▁▁█▁▁▁▁▁█
Alien - 200 subscribers   773.95 kb █▁▁▁▁█▁▁█▁█▁▁█▁▁███▁█

## Benchmarks, Set 2

However, the following benchmarks show that lattice DOES NOT have inherent memory issues with signals, computeds, or effects, individually:

### `scaling-computed`:

Lattice - 10 subscribers  173.96 kb ████▇▄▂▂▂▂▂▁▁▁▁▁▁▁▁▁▁
Lattice - 25 subscribers  273.85 kb ███▆▅█▇███▇▆▂▂▅▃▂▃▂▁▂
Lattice - 50 subscribers  387.19 kb ████▅▅▇████▁▅▃▃▁▃▅▃▁▃
Lattice - 100 subscribers 547.34 kb █▁▇▁▇█▇█▇█▇▁▇▇▇▁▁▁▇▇▇
Lattice - 200 subscribers 773.95 kb █▁████▁▁█▁▁▁█▁▁▁▁▁█▁█

Alien - 10 subscribers    174.19 kb ▆█████▆▄▇▅▄▃▂▂▂▂▁▁▁▁▁
Alien - 25 subscribers    273.85 kb ▁▁▁▁█▇█▇█▄▃▂▂▃▁▁▂▂▁▂▂
Alien - 50 subscribers    387.19 kb █████▄█▄██▄▁██▆▆▄▆▄▁▄
Alien - 100 subscribers   547.34 kb ████▁█▁▁▁█▁███▁███▁██
Alien - 200 subscribers   773.95 kb ██▁████▁▁▁▁█▁█▁█▁▁▁▁█

### `scaling-signal-effect`:

Lattice - 10 subscribers  312.23 kb ▁▂▁▁▁▁█████▇▆▄▃▂▂▁▁▁▁
Lattice - 25 subscribers  468.96 kb ▆██▆█████▄▄▃▂▄▂▂▂▃▂▁▂
Lattice - 50 subscribers  663.24 kb ▄▄▄█▆▁██▄█▆███▆▆█▁▄▁▄
Lattice - 100 subscribers 938.50 kb █▁▁▁▁█▁███▁█▁▁█▁▁██▁█
Lattice - 200 subscribers 1.30 mb   █▁██▁▁▁▁██▁▁█▁▁▁▁▁█▁█

Alien - 10 subscribers    297.58 kb ▆█▅▇█████▇██▇▃▃▂▂▂▁▂▁
Alien - 25 subscribers    468.96 kb ██▅██████████▃▂▃▄▃▃▂▂
Alien - 50 subscribers    663.25 kb ▅▃▅▃▅▃▇▅███▇▅█▅▁▃▃▅▅▃
Alien - 100 subscribers   937.79 kb ██▁█▁██▁▁█▁█▁▁▁█▁▁███
Alien - 200 subscribers   1.30 mb   █▁▁█▁▁▁███▁█▁█▁▁▁▁▁▁█

## Notes

What you'll notice is that the memory issues appear to have to do with consumers of computeds.

For instance, effect consumers of signals (`scaling-signal-effect`) and computed consumers of signals (`scaling-computed`) do NOT have memory issues, at any scale. `scaling-computed` also shows that simply reading computeds does NOT have memory issues.

What does appear to have memory issues is scenarios where computeds are consumed by other reactive primitives.

## IMPORTANT: THEORIES RULED OUT

**DO NOT WASTE TIME ON THESE - ALL CONFIRMED FALSE:**
- WeakMaps/WeakSets/Array tracking: Makes performance worse, doesn't fix memory
- Recursion in `pullUpdates`: Makes performance worse, doesn't fix memory
- Moving methods to prototype: Makes performance worse, doesn't fix memory
- Context accumulation: Disproved - moving context creation has no effect
- Closure cost: Disproved - `scaling-computed` shows identical memory to Alien
- Factory pattern overhead: Creating api once vs per-iteration has no effect
- **Dependency duplication**: FIXED via exhaustive search (graph-edges.ts:39-48), verified working, memory issue persists
- **"Baseline memory footprint"**: WRONG - `scaling-computed` proves Lattice matches Alien (547KB) for signal→computed
- **Mitata measurement**: Direct tests confirm real memory usage, not artifact
- **Pruning bug**: Real but doesn't affect stable benchmarks, fix attempts made it worse

## KEY FACTS

1. **Memory issue ONLY affects computed→computed patterns**:
   - `scaling-computed` (signal→computed): Lattice = Alien = 547KB ✅
   - `scaling-computed-computed` (computed→computed): Lattice = 38.3MB, Alien = 547KB ❌
   - 70x more memory ONLY when computeds read from other computeds

2. **Direct tests show minimal memory usage** (0.05-0.11 MB for 100k iterations)
   - But benchmarks report 3.82MB (diamond) and 38.3MB (scaling)
   - This is NOT a Mitata measurement issue - verified with multiple approaches

3. **The exhaustive dependency search fix IS working**
   - Verified preventing duplicate dependencies
   - But memory issue persists in benchmarks

## CURRENT STATUS

Something specific to computed→computed patterns in the benchmark environment causes massive memory retention that doesn't occur in isolated tests. The issue is NOT dependency duplication (fixed) or pruning (stable patterns unaffected).