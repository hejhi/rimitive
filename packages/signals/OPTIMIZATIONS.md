# Optimization Opportunities for @lattice/signals

## Current Performance Characteristics

- **Signal reads**: O(1) with dependency tracking
- **Signal writes**: O(n) where n = number of transitively dependent nodes
- **Computed reads**: O(d) where d = depth of dependency chain
- **Effect scheduling**: O(1) enqueue/dequeue

## Inherent Complexities vs Optimization Opportunities

### 1. **O(n) Signal Write Complexity**

**Inherent?** Partially. Push-based invalidation requires notifying all dependents.

**Optimizations:**
- **Early termination**: Stop traversal when all reachable nodes are already notified
- **Batch invalidation**: Group related signals to share traversal work
- **Selective invalidation**: Use bloom filters to quickly skip unrelated branches
- **Parallel traversal**: For wide graphs, use worker threads (complex but possible)

### 2. **O(d) Computed Chain Depth**

**Inherent?** No! This can be optimized significantly.

**Optimizations:**
- **Version vectors**: Track leaf dependencies directly, skip intermediate checks
- **Memoization**: Cache entire dependency chains between updates
- **Path compression**: Flatten deep chains into direct dependencies
- **Lazy path building**: Only trace full paths when values actually change

### 3. **Linear Dependency Search**

**Current:** O(n) search when checking if edge exists

**Optimizations:**
- **Bloom filters**: Quick negative lookups for large dependency sets
- **Hash maps**: For computeds with >10 dependencies
- **Better caching**: Update _lastEdge on successful lookups
- **Dependency indexing**: Maintain reverse index for O(1) lookups

## Proposed Optimizations

### High-Impact, Low-Complexity

1. **Enhanced Edge Caching**
   ```typescript
   // Update cache on every successful lookup
   if (node.source === source) {
     node.version = version;
     source._lastEdge = node; // ADD THIS
     return;
   }
   ```

2. **Dependency Count Threshold**
   ```typescript
   // Use hash map for nodes with many dependencies
   if (consumerDependencyCount > 10) {
     useHashMapLookup();
   } else {
     useLinearSearch();
   }
   ```

3. **Global Version Fast Path**
   ```typescript
   // Skip entire branches if nothing changed globally
   if (lastTraversalVersion === ctx.version) {
     return; // Nothing changed since last traversal
   }
   ```

### Medium-Impact, Medium-Complexity

1. **Bloom Filter for Large Graphs**
   - Reduces O(n) dependency checks to O(1) for negative cases
   - Minimal memory overhead (< 1KB per computed)
   - Already implemented in bloom-filter.ts

2. **Priority Queue for Effects**
   - Run UI-critical effects first
   - Batch similar effects together
   - Profile-guided scheduling

3. **Version Vector Optimization**
   - Skip intermediate computed checks
   - Direct leaf dependency tracking
   - Dramatic improvement for deep chains

### High-Impact, High-Complexity

1. **Incremental Graph Algorithms**
   - Maintain spanning tree of active dependencies
   - O(1) updates for most changes
   - Significant memory/complexity trade-off

2. **Parallel Invalidation**
   - Split wide graphs across workers
   - Requires thread-safe data structures
   - Only beneficial for very large graphs

3. **JIT Optimization**
   - Generate optimized code paths for hot computeds
   - Inline dependency checks
   - Requires runtime code generation

## Benchmark-Driven Optimization Strategy

1. **Profile First**
   - Identify hot paths in real applications
   - Measure actual depth/width distributions
   - Find pathological cases

2. **Incremental Implementation**
   - Start with simple optimizations (caching)
   - Measure impact before adding complexity
   - Keep fallbacks for edge cases

3. **Adaptive Strategies**
   - Choose algorithms based on graph shape
   - Self-tuning parameters
   - Runtime optimization selection

## Memory vs Speed Trade-offs

- **Bloom filters**: ~1KB per computed, 10x faster negative lookups
- **Version vectors**: ~100 bytes per computed, O(1) staleness checks
- **Hash maps**: ~50 bytes per dependency, O(1) lookups
- **Priority queues**: ~8 bytes per effect, better perceived performance

## Recommended Implementation Order

1. **Immediate**: Enhanced edge caching (1 line change)
2. **Next sprint**: Bloom filters for large dependency sets
3. **Following sprint**: Version vectors for deep chains
4. **Future**: Priority scheduling and parallel traversal

## Expected Performance Gains

- **Shallow, wide graphs**: 2-3x improvement with bloom filters
- **Deep, narrow graphs**: 5-10x improvement with version vectors
- **Mixed graphs**: 3-5x overall improvement with all optimizations
- **Memory usage**: +10-20% for significant speed gains

## Conclusion

While O(n) and O(d) complexities are partially inherent to the push-pull algorithm, significant optimizations are possible without changing the core architecture. The key insight is that most real-world reactive graphs have predictable patterns (sparse dependencies, moderate depth) that we can optimize for while maintaining correctness for edge cases.