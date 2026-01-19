# @rimitive/benchmarks

Performance benchmarks comparing rimitive against alien-signals and @preact/signals-core.

## Usage

```bash
pnpm bench                       # Run all benchmarks
pnpm bench diamond               # Run specific suite
pnpm bench --skip-build diamond  # Skip build step
```

## Suites

| Suite           | Description                                     |
| --------------- | ----------------------------------------------- |
| `diamond`       | Diamond dependency graphs for glitch prevention |
| `chain-deep`    | Deep linear dependency chains                   |
| `chain-shallow` | Shallow chains with many updates                |
| `batch-updates` | Batched signal updates                          |
| `fan-in`        | Many signals feeding into one computed          |
| `fan-out`       | One signal feeding many computeds               |
| `conditional`   | Conditional dependency tracking                 |
| `deep-wide`     | Deep and wide dependency graphs                 |

Results saved to `dist/` as markdown files.
