# Lattice Performance Analysis - Critical Findings

Lattice, despite sophisticated architecture (push-pull hybrid, topological ordering, glitch-free guarantees), is slower than Preact and Alien Signals in scenarios where performance degrades significantly under sustained load.

### KPI Benchmarks (`pnpm bench:kpi`)

| Benchmark | Lattice | Preact | Alien | Lattice Performance |
|-----------|---------|---------|--------|-------------------|
| **Deep Chain (100 levels)** | 40.89ms | 29.53ms | 24.49ms | 🔴 67% slower than Alien |
| **Diamond Dependencies** | 16.38ms | 15.38ms | 12.84ms | 🔴 28% slower than Alien |
| **Batch Updates (40 signals)** | 304µs | 261µs | 336µs | 🟡 Middle performer |
| **Fan-out (200 subscribers)** | 291ms | 141ms | 154ms | 🔴 2x slower than Preact |
| **Conditional (8 branches)** | 33.45ms | 29.57ms | 31.16ms | 🔴 Worst performer |

### Propagation Overhead Analysis

#### Minimal Propagation Test (`minimal-propagation.bench.ts`)
```
Single Hop (signal → computed → read):
- Alien: 16.50ms per 1M ops
- Preact: 18.70ms per 1M ops  
- Lattice: 21.08ms per 1M ops (28% slower)

Two Hops (signal → computed → computed → read):
- Alien: 38.05ms per 1M ops
- Lattice: 39.59ms per 1M ops (competitive!)
- Preact: 42.61ms per 1M ops

Pure Signal (no propagation):
- Alien: 2.10ms per 1M ops
- Preact: 5.14ms per 1M ops
- Lattice: 6.02ms per 1M ops (3x slower than Alien)
```

### Where Lattice Excels

#### Signal Operations (`signal-*` benchmarks)
```
Signal Reads (no propagation):
- Lattice: 48.37µs per iteration (FASTEST)
- Alien: 93.86µs per iteration  
- Preact: 242.64µs per iteration (5x slower)

Signal Writes (no propagation):
- Lattice: 63.22µs per iteration (FASTEST)
- Alien: 71.59µs per iteration
- Preact: 355.44µs per iteration (5.6x slower)

Mixed Read/Write:
- Lattice: 79.56µs per iteration (FASTEST)
- Alien: 292.48µs per iteration
- Preact: 377.61µs per iteration (4.7x slower)
```

#### Wide Fan-out Pattern (`pattern-wide-fanout.bench.ts`)
```
10 Computeds from Single Source:
- Lattice: 235µs (1.32x faster than Preact)
- Alien: 298µs
- Preact: 310µs

100 Computeds from Single Source:
- Lattice: 125µs (2.65x faster than Preact!)
- Alien: 301µs  
- Preact: 331µs
```

#### Observe/Unobserve Anomaly (`computed-chain-observe-unobserve.bench.ts`)
```
Very Deep Chain (20 levels):
- Lattice: 4.67µs (15x faster than competitors!)
- Alien: 73.12µs
- Preact: 72.62µs

BUT Shallow/Medium Chains:
- 3 levels: Lattice 41.55µs vs Alien 102µs (Lattice 2.5x faster)
- 10 levels: Lattice 46.37µs vs Alien 370µs (Lattice 8x faster)
```

**🟢 Insight**: Lattice appears to excel at **graph operations** (adding/removing edges, tracking observers) and **parallel updates** (wide fan-out), but struggles with **sequential propagation** (deep chains).

### Memory Pressure & Degradation

#### Performance Over Time (`memory-pressure.bench.ts`)
```
5-level chain, varying iterations:
        1K iter    100K iter   1M iter    Degradation
Lattice: 117.87ns → 134.70ns → 135.09ns  (+15%)
Alien:   98.55ns  → 109.40ns → 109.51ns  (+11%, then stable)
```

**🔴 Lattice degrades 15% under sustained load while Alien stabilizes**

## Architecture Hypothesis

### Two Performance Profiles

**Profile A - Where Lattice Excels:**
- Signal reads/writes without propagation (5x faster than Preact)
- Wide fan-out patterns (2.65x faster at 100 computeds)
- Graph mutation operations (observe/unobserve)

**Profile B - Where Lattice Fails:**
- Deep computed chains with propagation
- Diamond dependencies requiring glitch-free guarantees  
- Sustained high-frequency updates
- Memory-constrained environments

### Hypothesized Root Causes

1. **High Base Overhead**: Every operation pays for sophisticated infrastructure
   - Signal operations: 6ns (Lattice) vs 2.1ns (Alien)
   - First propagation hop: 15ns vs 14ns

2. **Memory Allocation Issues**:
   - Performance degrades 15% over time
   - Cache thrashing worse than competitors (75% vs 61% overhead)
   - Likely accumulating state in scheduling queues

3. **Architecture Mismatch**:
   - Optimized for graph management, not value propagation
   - Push-pull hybrid has high per-hop overhead
   - Topological ordering benefits don't offset costs

## File References

### Benchmark Files
- `/packages/benchmarks/src/suites/lattice/computed-diamond-simple.bench.ts` - Diamond pattern testing
- `/packages/benchmarks/src/suites/lattice/batch-updates-multiple.bench.ts` - Batching efficiency
- `/packages/benchmarks/src/suites/lattice/computed-chain-deep.bench.ts` - Deep chain propagation
- `/packages/benchmarks/src/suites/lattice/scaling-subscribers.bench.ts` - Fan-out scalability
- `/packages/benchmarks/src/suites/lattice/computed-conditional-simple.bench.ts` - Branch pruning
- `/packages/benchmarks/src/suites/lattice/minimal-propagation.bench.ts` - Isolated propagation cost
- `/packages/benchmarks/src/suites/lattice/memory-pressure.bench.ts` - Degradation testing

### Core Implementation Files
- `/packages/signals/src/helpers/scheduler.ts` - Unified scheduler with push propagation and scheduling
- `/packages/signals/src/helpers/pull-propagator.ts` - Pull propagation logic
- `/packages/signals/src/helpers/node-scheduler.ts` - Topological scheduling
- `/packages/signals/src/helpers/graph-edges.ts` - Intrusive edge management

### Benchmark Results
- `/packages/benchmarks/dist/latest-*.md` - Latest benchmark outputs
- `/packages/benchmarks/dist/*-summary.md` - Consolidated results

## Recommendations for Next Steps

1. **Micro Benchmarks**: In addition to `memory-pressure` and `minimal-propagation`, consider writing targeted micro benchmarks to reveal algorithmic bottlenecks
2. **Investigate Scheduling Queue**: Check if `node-scheduler.ts` accumulates state
3. **Examine Edge Management**: Intrusive lists in `graph-edges.ts` may have poor cache locality

## Commands for Reproduction

```bash
# Run KPI benchmarks
pnpm bench:kpi

# Run specific problematic benchmarks  
pnpm bench computed-chain-deep
pnpm bench minimal-propagation
pnpm bench memory-pressure

# Run additional diagnostics
pnpm bench pattern-wide-fanout signal computed-chain-observe-unobserve
```

When a Producer is "written to" (for a computed, it's whether it's value actually changes when executed after running dependencies):
- It checks if it's value has changed
- If not, it clears any STATUS_DIRTY flag and returns.
- If it has, it marks itself as STATUS_DIRTY and propagates STATUS_PENDING to all children

When a Consumer is executed:
- It looks at its direct Producers
- If any Producer is marked STATUS_DIRTY, it recomputes
- That recomputation causes re-execution of any Producers in it, propagating "up"

QUESTIONS:
- For signals, do we need to mark all children as STATUS_PENDING?
- Right now, computeds don't mark children at all. Should they?
- Do we need STATUS_PENDING? Effects don't need it (they get scheduled). Computeds look for STATUS_DIRTY on direct children and naturally propagate upwards. is STATUS_DIRTY enough?