# Memory Leak Root Cause Analysis & Solution

## Executive Summary

Identified a **memory leak** in Lattice's dependency management: When computed dependencies change, old Dependency objects accumulate without being cleaned up. The root cause is that **Lattice never calls detachAll() to clean up stale dependencies when the dependency graph changes**.

## The Problem

### Minimal Reproduction
```typescript
const signal1 = latticeSignal(1);
const signal2 = latticeSignal(2);
let useFirst = true;

// Computed that switches dependencies
const computed = latticeComputed(() => useFirst ? signal1() : signal2());
const dispose = latticeEffect(() => { computed(); });

// Each switch creates NEW dependency but never cleans up the old one
for (let i = 0; i < 100; i++) {
  useFirst = !useFirst;
  signal1(i);
  signal2(i);
}
// Result: 100+ Dependency objects accumulated in memory!
```

### Memory Growth Patterns
- **Static dependencies (same signal)**: NO LEAK (dependencies are reused correctly)
- **Changing dependencies**: SEVERE LEAK (old dependencies never cleaned)
- **Direct signal → effect**: NO LEAK
- **Signal → computed → effect with switching**: ~3.36 MB for 200 computeds with 100 switches

## Root Cause Analysis

### What Actually Happens

1. **Static Dependencies Work Fine**:
   - When dependencies don't change, `trackDependency` correctly reuses existing Dependency objects
   - Lines 28-35 of `graph-edges.ts` check for existing dependencies and return early
   - Result: 0 new allocations for static dependency graphs

2. **The Problem: No Cleanup When Dependencies Change**:
   ```typescript
   // When computed switches from signal1 to signal2:
   // 1. New dependency created for signal2
   // 2. Old dependency to signal1 still exists in memory
   // 3. detachAll() is NEVER called to clean up the old dependency
   ```

3. **Evidence from Tests**:
   - `detached-memory.test.ts`: 5 dependency switches = 5 accumulated objects
   - `detachAll` called 0 times during entire test
   - Memory growth: 3.36 MB with 200 computeds switching 100 times

### Why detachAll() Isn't Called

Looking at `track()` in `graph-edges.ts`:
```typescript
const track = <T>(ctx: GlobalContext, node: ConsumerNode, fn: () => T): T => {
  node.dependencyTail = undefined; // Reset tail
  ctx.currentConsumer = node;

  try {
    return fn(); // Re-track dependencies
  } finally {
    // This SHOULD clean up stale dependencies but doesn't work right:
    const tail = node.dependencyTail;
    let toRemove = tail ? tail.nextDependency : node.dependencies;
    if (toRemove) detachAll(toRemove); // Never gets called!
  }
};
```

The issue: When dependencies are reused (static case), the cleanup logic works. But when NEW dependencies are added (switching case), the old ones aren't properly identified for removal.

## How Alien-Signals Solves This

### The Version-Based Approach

Alien-signals uses a version number to track which dependencies are current:

```typescript
let currentVersion = 0;

function startTracking(sub: ReactiveNode): void {
  ++currentVersion;  // New version for this tracking cycle
  sub.depsTail = undefined;
}

function link(dep: ReactiveNode, sub: ReactiveNode): void {
  // Check for existing link and reuse with new version
  if (existingLink && existingLink.dep === dep) {
    existingLink.version = currentVersion;  // Reuse!
    return;
  }
  // Only create new if no existing link
}

function endTracking(sub: ReactiveNode): void {
  // Remove all links with old versions (not accessed this cycle)
  let toRemove = depsTail ? depsTail.nextDep : sub.deps;
  while (toRemove && toRemove.version !== currentVersion) {
    toRemove = unlink(toRemove);
  }
}
```

## The Solution for Lattice

### Implementation Plan

1. **Add version to context** (`context.ts`)
   ```typescript
   export interface GlobalContext {
     currentConsumer: ConsumerNode | null;
     version: number;  // Add this
   }
   ```

2. **Add version to Dependency** (`types.ts`)
   ```typescript
   export interface Dependency {
     producer: FromNode;
     consumer: ToNode;
     version: number;  // Add this
     // ... rest of fields
   }
   ```

3. **Update trackDependency to set version**
   ```typescript
   const trackDependency = (producer: FromNode, consumer: ToNode): void => {
     // ... existing reuse checks ...

     if (reused) {
       dependency.version = ctx.version;  // Update version on reuse
       return;
     }

     // Create new with current version
     const dependency: Dependency = {
       version: ctx.version,  // Set version
       // ... rest of fields
     };
   ```

4. **Fix track() to properly clean up**
   ```typescript
   const track = <T>(ctx: GlobalContext, node: ConsumerNode, fn: () => T): T => {
     ctx.version++;  // Increment version for new tracking cycle
     node.dependencyTail = undefined;

     try {
       return fn();
     } finally {
       // Clean up all dependencies with old versions
       let dep = node.dependencies;
       let prev: Dependency | undefined;

       while (dep) {
         const next = dep.nextDependency;
         if (dep.version !== ctx.version) {
           // This dependency wasn't accessed - remove it
           if (prev) {
             prev.nextDependency = next;
           } else {
             node.dependencies = next;
           }
           // Clean up the removed dependency
           detachDependency(dep);
         } else {
           prev = dep;
         }
         dep = next;
       }
     }
   };
   ```

## Verification Strategy

1. **Run `detached-memory.test.ts`**: Should show 0 dependency growth
2. **Run `scaling-memory-minimal.bench.ts`**: Should show < 1MB memory usage
3. **Verify `detachAll` is called**: Should be called when dependencies change
4. **Check heap snapshots**: Dependency count should remain constant

## Impact Assessment

- **Current**: Memory accumulation when dependencies change
- **After fix**: Stable memory usage regardless of dependency changes
- **Performance**: Better GC behavior, reduced memory pressure
- **User impact**: Long-running applications with dynamic dependencies won't leak