# @rimitive/benchmarks

Performance benchmarks for Rimitive reactive primitives.

## Quick Start

```bash
# Run all benchmarks
pnpm bench

# Run specific benchmark(s) by name
pnpm bench diamond
pnpm bench chain-deep fan-out

# Skip build step (faster iteration)
pnpm bench --skip-build diamond
```

---

## What's Measured

Benchmarks compare Rimitive signals against other reactive libraries:

- **alien-signals** — The library Rimitive's reactivity is based on
- **@preact/signals-core** — Preact's signal implementation

Each benchmark runs the same reactive pattern across all libraries, measuring throughput (operations/second).

---

## Benchmark Suites

| Suite                | Description                                     |
| -------------------- | ----------------------------------------------- |
| `diamond`     | Diamond dependency graphs for glitch prevention |
| `chain-deep`         | Deep linear dependency chains                   |
| `chain-shallow`      | Shallow chains with many updates                |
| `batch-updates`      | Batched signal updates                          |
| `fan-in`             | Many signals feeding into one computed          |
| `fan-out`            | One signal feeding many computeds               |
| `conditional` | Conditional dependency tracking                 |
| `deep-wide`          | Deep and wide dependency graphs                 |

### Diamond Pattern

Tests glitch-free propagation through diamond-shaped dependencies:

```
    source
    /    \
 left    right
    \    /
    bottom
```

The bottom computed must see consistent values from both paths—no intermediate states.

### Chain Patterns

Tests propagation through linear dependency chains:

```
signal → computed₁ → computed₂ → ... → computedₙ
```

Deep chains test propagation efficiency. Shallow chains with many updates test update throughput.

### Fan Patterns

**Fan-in**: Many sources converging to one computed:

```
signal₁ ─┐
signal₂ ─┼→ computed
signal₃ ─┘
```

**Fan-out**: One source feeding many computeds:

```
         ┌→ computed₁
signal ──┼→ computed₂
         └→ computed₃
```

---

## Output

Results are saved to `dist/` as markdown files:

```
dist/
├── latest-summary.md           # Overview of all benchmarks
├── latest-diamond.md    # Individual results
├── latest-chain-deep.md
└── ...
```

Each result includes:

- Benchmark name and timestamp
- Git commit hash
- System info (Node version, platform, CPUs)
- Formatted benchmark output with ops/sec

---

## Writing Benchmarks

Benchmarks use [mitata](https://github.com/evanwashere/mitata) for accurate measurement:

```typescript
import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { createSvc } from './deps/signal-computed';

const { signal, computed } = createSvc();

group('My Benchmark', () => {
  summary(() => {
    barplot(() => {
      bench('Rimitive', function* () {
        const source = signal(0);
        const derived = computed(() => source() * 2);

        yield () => {
          for (let i = 0; i < 10000; i++) {
            source(i);
            void derived();
          }
        };
      });

      // Add other libraries for comparison...
    });
  });
});

await runBenchmark();
```

Key patterns:

- Use `function*` generator syntax for setup/teardown
- `yield` the actual benchmark function
- Compare against the same pattern in other libraries

### Dependency Helpers

Pre-configured service factories in `./deps/`:

```typescript
import { createSvc } from './deps/signal-computed'; // signal + computed
import { createSvc } from './deps/signal-computed-effect'; // + effect
import { createSvc } from './deps/signal-computed-batch'; // + batch
```

---

## CI Integration

Benchmarks run in CI via `pnpm bench`. The runner:

1. Builds all packages first
2. Runs each `.bench.ts` file in `src/suites/core/`
3. Saves results as markdown with commit hash
4. Generates a summary with pass/fail status

---

## Tips

**Accurate measurement:**

- The runner uses `--expose-gc` for consistent GC behavior
- Each benchmark runs in its own subprocess for isolation
- Results include warmup iterations before measurement

**Debugging slow benchmarks:**

```bash
# Run with timeout
timeout 60 pnpm bench diamond

# Check a specific suite directly
npx tsx --expose-gc src/suites/core/diamond.bench.ts
```

**Adding new comparisons:**
Import the library and add a parallel `bench()` call with the same reactive pattern.

---

## License

MIT
