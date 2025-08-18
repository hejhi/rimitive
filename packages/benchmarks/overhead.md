⏺ Analysis Summary

  After systematic benchmark analysis and code investigation, here are the key findings:

  Main Performance Issues:

  1. Write Path Bottleneck (3.3x slower): Signal writes are significantly slower than Alien. The difference appears to be in how the dependency graph is traversed:
    - Alien: Directly propagates through Link structures with optimized bit flags
    - Lattice: Uses generic DFS traversal through Edge structures
  2. Computed Chain Overhead (1.14-1.26x): Consistent overhead across all computed chains, suggesting staleness checking inefficiency
  3. Batch Inefficiency (1.91x): Small batches perform poorly, likely because the propagator doesn't truly batch operations effectively

  Performance Wins:

  - Wide Fanout (1.4-3.4x faster): Lattice excels at one-to-many propagation patterns
  - Conditional Dependencies (1.4x faster): Better at complex conditional tracking

  ## Tested Optimizations (2025-08-18)

  ### ❌ Fast Path for Simple Subscribers (FAILED - broke tests)
  **Hypothesis**: Signal writes with only effect subscribers don't need full graph traversal
  **Implementation**: Added fast path in signal.ts that bypasses DFS for effect-only cases
  **Result**: Tests failed - computed nodes were not being properly invalidated
  **Conclusion**: The propagation system needs to traverse all nodes to maintain correctness

  ### ❌ Simple Function Call Overhead
  **Test**: Removed `invalidate()` wrapper, directly called `ctx.propagator.add()`
  **Result**: No measurable improvement (235.30 µs → 235.45 µs)
  **Conclusion**: The bottleneck is deeper than function call overhead

  ## Key Finding:

  The 3.3x performance gap is NOT from easily optimizable hot paths. The issue is fundamental:
  - Lattice uses a generic graph traversal system that handles complex cases
  - Alien uses specialized direct propagation optimized for simple cases
  - Any optimization that tries to skip the traversal breaks correctness

  ## Remaining Opportunities:

  1. **Graph Traversal Algorithm**: Need a fundamentally different approach, not just tweaks
  2. **Edge Structure Overhead**: The Edge abstraction itself may be the bottleneck
  3. **Batch Accumulation**: Better batching could reduce traversal frequency
  4. **Computed Chain Optimization**: Specialized handling for linear chains vs diamond dependencies