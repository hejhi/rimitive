# Critical Bugs in Pull Propagator

## Executive Summary

The pull propagator implementation has **fundamental violations of FRP invariants** that compromise correctness, consistency, and safety. These are not minor issues - they break core reactive programming principles.

## Bug #1: Diamond Dependency Failure (CRITICAL)

**Location:** `pull-propagator.ts` lines 75-78

**The Bug:**
```typescript
if (pStatus === STATUS_DIRTY) {
  hasDirty = true;
  break; // <-- THIS IS THE BUG!
}
```

**Impact:**
- In diamond patterns (A → B,C → D), when D pulls:
  - Finds B depends on dirty A, computes B
  - B becomes dirty, algorithm immediately computes D
  - C is NEVER computed, remains undefined
  - D gets wrong value (B + undefined instead of B + C)

**Test Case:** See `FAILS to compute all dependencies in diamond pattern`

## Bug #2: Glitch Vulnerability (HIGH)

**Impact:**
- Nodes can observe inconsistent intermediate states
- Violates FRP's glitch-freedom guarantee
- Can cause cascading errors in complex dependency graphs

**Example:**
- Two sources X=10, Y=20, Sum = X+Y = 30
- Update both: X=100, Y=200
- Pull propagator allows Sum to see X=100, Y=20 (inconsistent!)

## Bug #3: No Cycle Detection (CRITICAL)

**Impact:**
- Infinite loops on circular dependencies
- No visited set tracking
- Can crash entire application
- Memory exhaustion

**Test:** Disabled due to crashing test runner

## Bug #4: Incomplete Chain Propagation

**Impact:**
- Deep dependency chains don't fully propagate
- Values remain undefined/NaN
- Silent failures in complex graphs

## Root Cause

The algorithm has a fundamental design flaw: it eagerly recomputes nodes upon finding ANY dirty dependency, without ensuring ALL dependencies are up-to-date first.

**Correct Algorithm Should:**
1. Traverse ALL dependencies
2. Recursively pull PENDING dependencies
3. Only after ALL deps are CLEAN/DIRTY, recompute current node
4. Maintain visited set to avoid redundant work

## Severity Assessment

These bugs violate core FRP invariants:
- **Correctness:** Wrong computed values
- **Consistency:** Glitches and intermediate states
- **Completeness:** Partial updates
- **Safety:** Infinite loops possible
- **Performance:** Inefficient recomputation patterns

## Recommendation

The pull propagator needs significant refactoring to:
1. Remove the early `break` on dirty dependencies
2. Ensure all dependencies are processed before recomputation
3. Add cycle detection with visited set
4. Implement proper topological ordering

The current implementation is **not production-ready** and will cause incorrect behavior in any non-trivial reactive application.