# Redundant isStale() Calls - Code Flow Analysis

## The Problem in Detail

When reading c3 after a signal update, here's the EXACT code flow:

### Step 1: c3.read() is called
```typescript
// computed.ts line 117-129
const computed = (() => {
  // ... dependency tracking ...
  update();  // <-- This gets called
  return state.value;
})
```

### Step 2: c3's update() checks staleness
```typescript
// computed.ts line 103-114
const update = () => {
  if (state._flags & DIRTY) recompute();
  else if (state._flags & INVALIDATED) {
    if (isStale(state)) recompute();  // <-- c3 calls isStale()
    else state._flags = state._flags & ~INVALIDATED;
  }
}
```

### Step 3: isStale(c3) traverses the chain
```typescript
// dependency-graph.ts line 154-255
const isStale = (node: ToNode): boolean => {
  // ... traversal setup ...
  
  // Traverses: c3 → c2 → c1 → signal
  for (;;) {
    while (currentEdge) {
      // Check each dependency
      const source = currentEdge.from;
      // ... traversal logic ...
    }
    
    // LINE 237-242: Updates computeds during unwinding
    if (currentNode !== node) {
      if (stale && isDerived(currentNode)) {
        stale = currentNode._recompute();  // <-- Recomputes c1, then c2
        currentNode._flags &= ~INVALIDATED;
      }
    }
  }
}
```

### Step 4: THE PROBLEM - During c2's recomputation

When `c2._recompute()` runs (called from isStale's line 242):

```typescript
// c2's compute function
() => c1() + 1
```

This calls `c1()`, which goes through:

```typescript
// computed.ts line 117-129 (c1's read function)
const computed = (() => {
  update();  // <-- c1's update() gets called
  return state.value;
})

// computed.ts line 103-114 (c1's update function)
const update = () => {
  else if (state._flags & INVALIDATED) {
    if (isStale(state)) recompute();  // <-- REDUNDANT isStale(c1) call!
  }
}
```

**BUT WAIT!** Shouldn't line 245 in dependency-graph.ts prevent this?

```typescript
currentNode._flags &= ~INVALIDATED;  // Clear flag after recompute
```

**The problem is timing:**
1. isStale(c3) recomputes c1 (line 242)
2. isStale(c3) clears c1's INVALIDATED flag (line 245)
3. isStale(c3) recomputes c2 (line 242 again, further up the stack)
4. c2's recompute reads c1
5. c1's read function calls update()
6. **c1's INVALIDATED flag is already cleared, so it doesn't call isStale()!**

Wait, that means the issue is DIFFERENT than expected...

## Actually, the REAL issue is:

Looking at the trace output, we see 3 isStale() calls for a 3-computed chain. This suggests:

1. `c3.read()` → `isStale(c3)` - Call #1 ✓
2. During c3's recompute: `c2.read()` → `isStale(c2)` - Call #2 ❌
3. During c2's recompute: `c1.read()` → `isStale(c1)` - Call #3 ❌

The problem is that when isStale() recomputes nodes during traversal (line 242), those recomputes trigger reads of dependencies, which ALSO check staleness!

## Why Does This Happen?

The issue is that `isStale()` doesn't recompute ALL nodes in the chain before returning. It only recomputes nodes BELOW the requested node:

```typescript
// Line 237-242
if (currentNode !== node) {  // <-- Only recomputes dependencies, not the root
  if (stale && isDerived(currentNode)) {
    stale = currentNode._recompute();
  }
}
```

So when `isStale(c3)` returns:
- c1 has been recomputed ✓
- c2 has been recomputed ✓  
- c3 has NOT been recomputed yet ❌

Then c3's update() function calls `recompute()`, which reads c2, but c2 still has INVALIDATED flag set because isStale(c3) didn't clear it!

## The Actual Flow:

1. **c3.read()** → update() → isStale(c3)
   - Traverses to c1, recomputes c1
   - Traverses back, recomputes c2
   - Returns true (stale)
   
2. **c3.update()** continues → recompute()
   - c3._recompute() reads c2()
   
3. **c2.read()** → update() → sees INVALIDATED flag → isStale(c2) ❌ REDUNDANT
   - Even though c2 was JUST recomputed by isStale(c3)!

4. **During c2's redundant isStale()**: c1.read() → isStale(c1) ❌ REDUNDANT

## The Fix Would Be:

Either:
1. Have isStale() also recompute the root node (not just dependencies)
2. Have isStale() clear INVALIDATED flags for ALL recomputed nodes
3. Track that we're in a recomputation phase to skip staleness checks

This is why Alien's single-pass approach is more efficient - it doesn't have this two-phase problem!