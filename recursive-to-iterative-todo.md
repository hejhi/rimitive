# Recursive to Iterative Conversion TODO

## Goal
Eliminate recursive dependency checking in Lattice Signals to improve performance in conditional dependency scenarios.

## Key Discovery
The recursion happens because `checkNodeDirty` calls `source._update()`. A unified iterative update system is required, not just an iterative `checkNodeDirty`.

## Current Status (2025-08-03)
**Phase 3 Completed** - Optimized iterative implementation is ready for integration.

### What's Been Done:
- ✅ Created optimized `iterativeUpdate` function with object pooling
- ✅ Reduced stack depth from 40-120 frames to <5 frames
- ✅ Achieved performance improvements for deep chains (20+ levels)
- ✅ All tests passing with identical behavior to recursive approach
- ✅ Code consolidated to single clear implementation

### Performance Results:
- **Deep chains (20+ levels)**: 1.1x to 2.7x faster
- **Shallow chains (<20 levels)**: Minor overhead (1.06x slower)
- **Stack overflow risk**: Eliminated
- **Memory**: Pre-allocated pools reduce GC pressure

### Files to Use:
- `packages/signals/src/helpers/iterative-update.ts` - The optimized implementation
- `packages/signals/src/helpers/iterative-update.test.ts` - Comprehensive tests

## Next Steps

### Phase 4: Integration (Ready to Start)
- [ ] Modify `packages/signals/src/computed.ts` to use `iterativeUpdate` instead of recursive `_update()`
- [ ] Update `checkNodeDirty` in `dependency-tracking.ts` to work with iterative approach
- [ ] Run full test suite: `pnpm --filter @lattice/signals test`
- [ ] Run benchmarks: `pnpm --filter @lattice/benchmarks bench:dev`

### Phase 5: Further Optimization
- [ ] Investigate why Alien is still 2.7x faster for conditional dependencies
- [ ] Consider additional optimizations for conditional dependency tracking
- [ ] Profile the integrated solution to find remaining bottlenecks

## Technical Details

The implementation uses a state machine with 5 phases:
1. **check-dirty**: Examine flags (OUTDATED/NOTIFIED)
2. **traverse-sources**: Walk dependencies, check versions
3. **wait-for-source**: Handle computed sources needing update
4. **ready-to-compute**: Execute callback if needed
5. **computed**: Update versions and cleanup

### Key Optimizations:
- Pre-allocated frame pool (100 frames)
- Pre-allocated stack array (100 slots)
- Array-based visiting tracker instead of Set
- Numeric phase constants instead of strings
- Object reuse to minimize allocations

## Important Notes:
- The 2.72x gap with Alien-signals isn't fully closed by this optimization alone
- The iterative approach provides the foundation for additional optimizations
- Integration should be done carefully to avoid breaking existing functionality