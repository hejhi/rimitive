# Recursive to Iterative Conversion TODO

## Goal
Eliminate recursive dependency checking in Lattice Signals to improve performance in conditional dependency scenarios.

## Key Discovery
The recursion happens because `checkNodeDirty` calls `source._update()`. A unified iterative update system is required, not just an iterative `checkNodeDirty`.

## Quick Start
1. Read the recursive chain in `computed.ts:105` → `dependency-tracking.ts:96`
2. Review proof of concept: `packages/signals/src/helpers/iterative-update.ts`
3. Run tests: `pnpm --filter @lattice/signals test iterative-update-poc`
4. Start with Phase 3 optimization tasks below

## Implementation Plan

### Phase 1: Analysis & Setup ✅
- Created benchmark showing 2.72x performance gap
- Created comprehensive test suite
- Identified recursive call chain across 4 functions

### Phase 2: Proof of Concept ✅
- Implemented `iterativeUpdate` with state machine approach
- Verified correctness - all tests pass
- Achieved 2x speedup for shallow chains
- Identified optimization needs for deep chains

### Phase 3: Optimization (Current)
- [ ] Profile `iterative-update.ts` to identify allocation hotspots
- [ ] Pre-allocate stack array instead of dynamic push/pop
- [ ] Reuse frame objects instead of creating new ones
- [ ] Benchmark after each optimization using `iterative-benchmark.test.ts`

### Phase 4: Integration
- [ ] Modify `packages/signals/src/computed.ts` to use iterative approach
- [ ] Update `checkNodeDirty` in `dependency-tracking.ts` to not call `_update()`
- [ ] Run full test suite: `pnpm --filter @lattice/signals test`
- [ ] Check for performance regressions in other benchmarks

### Phase 5: Validation
- [ ] All existing tests pass
- [ ] Benchmark shows <1.5x gap with alien-signals
- [ ] Memory usage equal or better
- [ ] Call stack depth <5 frames

## Technical Approach

State machine with phases:
1. **check-dirty**: Examine flags (OUTDATED/NOTIFIED)
2. **traverse-sources**: Walk dependencies, check versions
3. **wait-for-source**: Handle computed sources needing update
4. **ready-to-compute**: Execute callback if needed
5. **complete**: Update versions and cleanup

Critical: Never call `_update()` recursively. Use explicit stack for all state management.