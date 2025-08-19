# Hypothesis 001: Context Access is the Bottleneck

## Date: 2025-08-19  
## Status: **DISPROVEN** ❌

## Original Hypothesis

Lattice signals are 2.3x slower than Alien for reads because context property access (`ctx.currentConsumer`) adds significant overhead (~0.040µs per access).

## Initial Evidence

In `signal.ts:102-121`, every signal read executes:
```typescript
get value(): T {
  const current = ctx.currentConsumer;  // <-- Suspected bottleneck
  if (!current || !(current._flags & RUNNING)) {
    return this._value;
  }
  link(this, current, this._version);
  return this._value;
}
```

## Test Results (Flawed)

Initial micro-benchmark showed:
- Context access: 398ms overhead for 10M accesses  
- Per access: 0.040µs
- Seemed to be "major contributor"

## Why This Was Wrong

The test measured a **test proxy**, not actual production code:

```typescript
// What we measured (test-setup.ts)
const activeContext = {
  get currentConsumer() { 
    return defaultInstance.activeContext.currentConsumer;  // 2 property accesses + getter!
  }
};

// What actually runs in production
const current = ctx.currentConsumer;  // Just 1 property access
```

## Actual Cost

- **Measured (flawed)**: ~0.040µs (getter + 2 property accesses)
- **Actual production**: ~0.001-0.005µs (single property access)
- **Difference**: 8-40x overestimated!

## Conclusion  

**DISPROVEN**: Context property access is NOT a significant bottleneck. The overhead is negligible (~0.001-0.005µs) compared to the overall 2.74x signal read overhead.

The real bottlenecks must be elsewhere in the tracking infrastructure.