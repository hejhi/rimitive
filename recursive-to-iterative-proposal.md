# Technical Approach: Iterative Dependency Updates

## Overview

This document describes the technical approach for converting Lattice's recursive dependency checking to an iterative implementation.

## Why Simple Conversion Fails

The recursion in Lattice is distributed across multiple functions:
- `computed._update()` calls `shouldNodeUpdate()`
- `shouldNodeUpdate()` calls `checkNodeDirty()`  
- `checkNodeDirty()` calls `source._update()` (recursion restarts)

Simply making one function iterative doesn't work because each function in the chain can trigger new recursive calls.

## Proposed Solution: Unified State Machine

Replace the distributed recursion with a single iterative function that manages all update phases through an explicit state machine.

### Core Design Principles

1. **Explicit Stack Management**: Replace call stack with data structure
2. **State Machine Phases**: Model the update process as discrete states
3. **Object Pooling**: Reuse frame objects to minimize allocations
4. **Visiting Set**: Track nodes being processed to detect cycles

### State Machine Phases

1. **CHECK_DIRTY**: Examine node flags (OUTDATED/NOTIFIED)
2. **TRAVERSE_SOURCES**: Walk dependency edges, checking versions
3. **WAIT_FOR_SOURCE**: Pause while a dependency updates
4. **READY_TO_COMPUTE**: All dependencies fresh, run callback if needed
5. **COMPUTED**: Update complete, clean up and pop stack

### Key Data Structures

- **Update Frame**: Tracks state for each node being processed
  - Current node reference
  - Current phase
  - Source traversal position
  - Dirty flag
  
- **Stack**: Array of frames replacing the call stack
- **Visiting Set**: Tracks in-progress updates for cycle detection

## Implementation Approach

### Phase 1: Core Algorithm
- Implement basic state machine without optimizations
- Ensure correctness with comprehensive tests
- Verify identical behavior to recursive version

### Phase 2: Performance Optimization  
- Add object pooling for frame reuse
- Use numeric constants instead of strings
- Pre-allocate arrays where beneficial
- Profile and measure improvements

### Phase 3: Integration Planning
- Design integration points with existing code
- Plan migration strategy
- Consider rollback approach

## Trade-offs and Considerations

### Benefits
- **Eliminates stack overflow risk**: Bounded memory usage
- **Improves deep chain performance**: Less function call overhead
- **Better debugging**: Explicit state is easier to inspect
- **Foundation for future optimizations**: Easier to add caching, etc.

### Costs
- **Code complexity**: State machine harder to understand than recursion
- **Slight overhead for shallow chains**: Setup cost for simple cases
- **Maintenance burden**: More code to maintain

### Open Questions

1. **Dynamic vs Fixed Arrays**: Should stack/visiting sets grow dynamically?
2. **Pool Sizes**: What are optimal pre-allocation sizes?
3. **Integration Points**: How to minimize changes to existing code?
4. **Performance Gap**: Why is alien-signals still faster for conditional dependencies?

## Risk Mitigation

- **Feature flag**: Allow toggling between recursive/iterative
- **Extensive testing**: Cover all edge cases before integration
- **Gradual rollout**: Test in development before production
- **Performance monitoring**: Track metrics before/after change