#!/bin/bash
# Run a specific vitest benchmark file

if [ $# -eq 0 ]; then
    echo "Usage: ./bench-vitest.sh <benchmark-name>"
    echo "Example: ./bench-vitest.sh propagation-test"
    exit 1
fi

# Build if needed
pnpm build:all

# Run the benchmark
npx vitest bench --run "src/suites/lattice/$1.bench.ts"