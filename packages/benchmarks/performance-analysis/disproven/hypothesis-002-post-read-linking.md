# Hypothesis 002: Post-Read Dependency Linking

## Date: 2025-08-19
## Status: **DISPROVEN** ❌

## Hypothesis

Changing the order of operations in signal reads from:
1. Check context
2. Check tracking  
3. Link dependencies
4. Read value

To Alien's approach:
1. Read value first
2. Check context
3. Check tracking
4. Link dependencies

Would improve performance by optimizing for the untracked read case.

## Implementation

Changed `signal.ts` getter from:
```typescript
// BEFORE
get value(): T {
  const current = ctx.currentConsumer;
  if (!current || !(current._flags & RUNNING)) return this._value;
  link(this, current, this._version);
  return this._value;
}
```

To:
```typescript
// AFTER  
get value(): T {
  const value = this._value;  // Read first
  const current = ctx.currentConsumer;
  if (current && (current._flags & RUNNING)) {
    link(this, current, this._version);
  }
  return value;
}
```

## Test Results

### Micro-benchmark (untracked-read-overhead.test.ts)

**Before:**
- Overhead ratio: 2.74x
- Signal read: 3.56ms for 1M reads

**After:**
- Overhead ratio: 2.77x (slightly worse)
- Signal read: 3.57ms for 1M reads

### Real-world benchmarks

**Signal Reads:**
- Before: 213.53 µs/iter
- After: 213.89 µs/iter
- **No improvement**

**Signal Writes:**
- Before: 234.75 µs/iter  
- After: 234.31 µs/iter
- **No improvement**

## Analysis

Post-read linking alone does **not** provide performance benefits because:

1. **Context access still happens**: We still pay the 0.040µs cost of accessing `ctx.currentConsumer`

2. **Branch still exists**: We still have the conditional check, just inverted

3. **V8 optimization unchanged**: The JavaScript engine likely optimizes both patterns similarly

4. **Memory access pattern same**: Reading `this._value` is cheap either way

## Why Alien's Approach Works

Alien's speed comes from **multiple optimizations working together**:

1. **Module-level tracking state** (no context object)
2. **Function binding** (no class overhead)
3. **Post-read linking** (minor contribution)
4. **Simpler conditional** (`if (activeSub !== undefined)`)

Post-read linking alone is insufficient. The real bottleneck is the context object property access.

## Conclusion

This hypothesis is **DISPROVEN**. Simply reordering operations without addressing the fundamental context access overhead provides no measurable benefit.
