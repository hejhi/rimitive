# Hypothesis 010: Alien-Style O(1) Link Algorithm

## Date: 2025-08-19
## Status: **DISPROVEN** ❌

## Hypothesis

Adopting Alien's O(1) link algorithm (no linear search, just check last 2 dependencies) would eliminate the 35-88x overhead in tracked operations.

## Implementation

Changed link() in dependency-graph.ts to:
1. Check tail (most recent dependency)
2. Check second most recent 
3. **Skip linear search entirely** - just create new edge
4. Trade potential duplicate edges for guaranteed O(1) performance

This exactly mirrors Alien's approach where they never search beyond the 2-element cache.

## Results

### Performance Impact: **ZERO**

| Operation | Before | After | Change |
|-----------|--------|-------|--------|
| **Signal reads** | 213.32 µs | 216.34 µs | 1.4% worse |
| **Signal writes** | 234.67 µs | 237.32 µs | 1.1% worse |
| **1 consumer (tracked)** | ~32,000 ops/sec | 31,685 ops/sec | ~same |
| **5 consumers** | ~20,000 ops/sec | 19,689 ops/sec | ~same |

### Link Overhead Benchmark

Still showing 31-53x overhead for tracked operations despite eliminating O(n) search.

## Analysis

This is a critical discovery: **The O(n) search was NOT the bottleneck!**

Despite our benchmarks showing:
- Linear search through dependencies
- Complex reordering logic
- Multiple pointer operations

Eliminating all of this had no measurable impact.

## What This Means

1. **The bottleneck is elsewhere** - Not in the link() algorithm itself
2. **Our performance analysis was wrong** - We measured the wrong thing
3. **The overhead might be in**:
   - The fact that link() is called at all
   - The Edge object creation/management
   - Something in the signal getter before link()
   - The context/consumer tracking setup

## Why Alien is Still Faster

Since eliminating the O(n) search didn't help, Alien's advantage must come from:
1. **Not calling link() as often** - Different tracking strategy
2. **Lighter weight tracking** - No Edge objects at all?
3. **Different architecture** - Module-level state vs context
4. **Something we haven't identified yet**

## Lesson Learned

**Optimizing the wrong bottleneck yields no improvement.** The 35-88x overhead for tracked operations isn't from the link() algorithm's complexity - it's from something more fundamental about how tracking works.

## Next Steps

Need to investigate:
1. Why is link() being called so much?
2. What happens before link() in the signal getter?
3. Is the Edge object structure itself the problem?
4. How does Alien avoid this overhead entirely?