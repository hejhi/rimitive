# Prompt: Implement Iterative Dependency Checking for Lattice Signals

## Problem

Lattice has a performance bottleneck due to distributed recursion when updating computed values:

```
computed.value → _update() → shouldNodeUpdate() → checkNodeDirty() → source._update() → (recursion!)
```

This creates deep call stacks (40-120 frames) with nested dependencies.

### Key Files to Examine

1. `packages/signals/src/computed.ts` - See `_update()` method (line ~105)
2. `packages/signals/src/helpers/dependency-tracking.ts` - See `checkNodeDirty()` (line ~96)
3. `packages/benchmarks/src/suites/lattice/recursive-vs-iterative.bench.ts` - Performance test
4. `packages/signals/src/helpers/iterative-update.ts` - **Completed implementation**

## Solution Implemented (2025-08-03)

Created a unified iterative update system that eliminates all recursive calls while preserving exact reactive behavior.

### Implementation Highlights

1. **State Machine Architecture**:
   - 5 phases: check-dirty → traverse-sources → wait-for-source → ready-to-compute → computed
   - Numeric phase constants for performance
   - Explicit stack management

2. **Performance Optimizations**:
   - Pre-allocated frame pool (100 objects)
   - Pre-allocated stack array (100 slots)
   - Array-based visiting tracker instead of Set
   - Object reuse to minimize GC pressure

3. **Results Achieved**:
   - ✅ Stack depth reduced from 40-120 to <5 frames
   - ✅ Deep chains (20+ levels): 1.1x to 2.7x faster
   - ✅ All tests passing with identical behavior
   - ⚠️ Conditional dependencies: Still 2.7x gap with Alien

## Lessons Learned

### What Worked Well:
1. **Incremental Development**: Building POC first, then optimizing
2. **Object Pooling**: Significant reduction in allocations
3. **State Machine Design**: Clear phases made debugging easier
4. **Comprehensive Testing**: Ensured correctness throughout

### Challenges Encountered:
1. **TypeScript Strictness**: Required careful null handling with pre-allocated arrays
2. **Performance Trade-offs**: Small overhead for shallow chains due to pooling setup
3. **Root Cause**: The 2.7x gap suggests the recursion wasn't the only bottleneck

### Key Insights:
1. **Holistic Approach Required**: Can't just make one function iterative - need unified system
2. **Memory vs Speed**: Pre-allocation helps but adds complexity
3. **Benchmarking is Critical**: Real-world performance differs from theory
4. **Further Investigation Needed**: Alien's conditional dependency optimization remains superior

## For Next Implementation:

1. **Integration Steps**:
   ```typescript
   // In computed.ts _update() method
   import { iterativeUpdate } from './helpers/iterative-update';
   
   // Replace recursive call with:
   iterativeUpdate(this, ctx);
   ```

2. **Areas to Investigate**:
   - Why Alien is 2.7x faster at conditional dependencies
   - Whether dependency tracking itself can be optimized
   - If there are smarter ways to skip unnecessary updates

3. **Potential Optimizations**:
   - Lazy dependency tracking
   - Better conditional branch detection
   - Smarter version comparison strategies

## Files Ready for Use:
- `packages/signals/src/helpers/iterative-update.ts` - Production-ready implementation
- `packages/signals/src/helpers/iterative-update.test.ts` - Comprehensive test suite

The iterative foundation is solid and ready for integration. The remaining performance gap requires deeper analysis of Alien's approach to conditional dependencies.