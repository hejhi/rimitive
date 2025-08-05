# Filtered Diamond Warmup Analysis

## Key Finding

The warm-up benchmark reveals that **cold start performance is NOT the issue**. In fact:

1. **Cold start**: All three libraries perform similarly (4-5 million ops/sec)
   - Alien: 5.31M ops/sec
   - Preact: 4.99M ops/sec  
   - Lattice: 4.74M ops/sec (only 10-12% slower than others)

2. **Warm performance**: Lattice shows significantly worse performance
   - Mixed changes (50% filtered): Lattice is 1.95x slower than Preact
   - Mostly filtered (90% filtered): Lattice is 1.44x slower than Preact

## Performance Breakdown

### Mixed Changes (alternating filtered/unfiltered)
- Preact: 1,433 ops/sec
- Alien: 1,316 ops/sec
- Lattice: 1,020 ops/sec (slowest)

### Mostly Filtered (90% values filtered out)
- Preact: 1,992 ops/sec (fastest)
- Alien: 1,764 ops/sec
- Lattice: 1,387 ops/sec

## Conclusion

The performance gap is NOT due to cold start/initialization overhead. The issue is in the steady-state execution when computeds don't propagate changes effectively.

With proper warm-up, we can see that:
- Lattice consistently underperforms in scenarios with filtering
- The gap is larger when more values are filtered (90% filtered case)
- This confirms the push-pull optimization opportunity: Lattice is doing unnecessary work when intermediate computed values don't change

## Next Steps

Focus optimization efforts on:
1. Implementing proper push-pull lazy evaluation
2. Avoiding unnecessary downstream computation when intermediate values don't change
3. The filtered diamond pattern is the key optimization target