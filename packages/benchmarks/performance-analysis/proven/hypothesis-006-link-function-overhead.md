# Hypothesis 006: Link Function Overhead

## Date: 2025-08-19  
## Status: Testing

## Hypothesis

The `link()` function in dependency-graph.ts is a performance disaster even for the "fast path" due to complex caching logic and excessive pointer manipulation.

## Evidence

### Code Analysis

The `link()` function (dependency-graph.ts:42-126) has multiple issues:

```typescript
// 1. Two-level cache lookup (lines 48-60)
const tail = consumer._inTail;
if (tail !== undefined && tail.from === producer) return; // Cache hit 1

const nextAfterTail = tail !== undefined ? tail.nextIn : consumer._in;
if (nextAfterTail !== undefined && nextAfterTail.from === producer) return; // Cache hit 2

// 2. Linear search through edges (lines 63-90)
let edge = nextAfterTail;
while (edge) {
  if (edge.from === producer) {
    // 18 lines of linked list manipulation!
    moveToTail(edge);
    return;
  }
  edge = edge.nextIn;
}

// 3. New edge allocation (lines 97-126)
const newEdge: Edge = {
  from: producer,
  to: consumer,
  fromVersion: producerVersion,
  prevIn: prevDep,
  prevOut,
  nextIn: nextDep,
  nextOut: undefined,
};
```

### Performance Impact

Even when dependency already exists:
1. **Two cache checks** with property access
2. **Potential linear search** through dependency list
3. **Complex reordering logic** (moveToTail)
4. **8 property assignments** for new edges

### Competitor Comparison

**Alien:** Direct array manipulation
```javascript
// Simple push to array
node.subs.push(activeSub);
```

**Preact:** Basic linked list
```javascript
// Simple node creation
new Node(signal, computed);
```

## Theory

The `link()` function adds massive overhead because:
1. **Cache misses are common** - first read always misses
2. **Linear search** - O(n) in dependency count
3. **Object allocation** - new Edge in hot path
4. **Complex manipulation** - 30+ lines for simple operation

## Test Plan

1. **Profile link() directly** - measure time spent
2. **Test with varying dependency counts** (0, 1, 5, 10)
3. **Compare with stub implementation** that does nothing
4. **Measure allocation rate** during signal reads

## Expected Results

If correct:
- `link()` accounts for 30-50% of read overhead
- Performance degrades with dependency count
- First access (cache miss) is significantly slower
- High allocation rate during reads

## Proposed Fix

1. **Simplify for common case** - most signals have 0-1 consumers
2. **Avoid allocation** - reuse edge objects
3. **Remove caching complexity** - simpler is faster
4. **Consider array-based approach** for small dependency counts