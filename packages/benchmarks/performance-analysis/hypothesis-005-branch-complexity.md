# Hypothesis 005: Branch Complexity and Misprediction

## Date: 2025-08-19
## Status: Testing

## Hypothesis

The 2.74x overhead in signal reads comes from complex branch logic causing CPU pipeline stalls and mispredictions.

## Evidence

### Current Implementation
```typescript
// signal.ts - Complex double condition
if (!current || !(current._flags & RUNNING)) {
  return this._value;
}
```

This creates:
1. **Two branch conditions** in the hot path
2. **Bitwise operation** in the condition
3. **Unpredictable pattern** when mixing tracked/untracked reads

### Competitor Comparison

**Alien:** Simple single check
```javascript
if (activeSub !== undefined) {
  // link dependency
}
```

**Preact:** Also simpler condition
```javascript
if (currentComputed) {
  // track dependency  
}
```

## Theory

The complex branch `(!current || !(current._flags & RUNNING))`:
1. Forces CPU to evaluate two conditions
2. Creates unpredictable branch patterns
3. Causes pipeline stalls on misprediction (10-20 cycles penalty)

## Test Plan

1. **Measure branch misprediction rate** using performance counters
2. **Test simplified branch** - single condition check
3. **Compare predictable vs unpredictable patterns**:
   - All untracked reads (predictable)
   - All tracked reads (predictable)
   - Mixed pattern (unpredictable - worst case)

## Expected Results

If correct:
- Mixed tracked/untracked pattern shows highest overhead
- Simplified branch reduces overhead by 20-40%
- Branch misprediction rate correlates with performance gap

## Proposed Fix

Simplify to single predictable branch:
```typescript
get value(): T {
  const current = ctx.currentConsumer;
  if (current?._flags & RUNNING) {
    link(this, current, this._version);
  }
  return this._value;
}
```

Or even better, separate tracked/untracked paths entirely.