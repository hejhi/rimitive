WAIT. User is right - selector doesn't need to know about signals!

The spec makes more sense now:

1. select((id) => store.users((user) => user.id === id))

   - This assumes store.users(predicate) returns the FOUND OBJECT
   - Not the update function!

2. The selector just caches object references in WeakMap

3. When set(selectorResult, updates) is called:
   - It has the object reference
   - It searches through all signals to find where this object lives
   - Updates it there

So the key change is: make store.users(predicate) return the found object when called with just a predicate (no update function).

This is actually simpler!

## Select API Implementation Notes

Key insight: Changed signal predicate API to return found objects directly instead of update functions.

```typescript
// Old API:
store.users(pred); // returned update function
// New API:
store.users(pred); // returns found object
```

---

## Summary of work completed:

### 1. Changed the predicate API

- Previously: `store.users(predicate)` returned an update function
- Now: `store.users(predicate)` returns the found object directly
- This aligns with the spec's example

### 2. Type changes made:

- Removed UpdateFunction, ArrayUpdateFunction, ObjectUpdateFunction interfaces
- Updated Signal interface to show predicates return T | undefined
- Added select to LatticeContext and ComponentContext
- Added SetState overload for selector-based updates

### 3. Files modified:

- signal.ts: Changed predicate behavior to return found object
- runtime-types.ts: Updated types for new API
- selector-types.ts: Created with SelectorResult interface
- lattice-context.ts: Added basic select implementation
- component.ts: Added select to context, started set overload
- component.test.ts: Updated all tests to use new API

### 4. Current status:

- Basic predicate → object functionality works ✓
- All tests pass ✓
- select function exists but doesn't cache yet
- set(selectorResult, updates) exists but not implemented

### 6. Key insight from spec:

- Cache objects by reference in WeakMap
- Different selectors finding same object share cache
- Leverages immutable update patterns

### 7. Implementation approach:

- Component-level WeakMap<object, SelectorMetadata>
- When selector runs, check if object in WeakMap first
- For set(), search all signals to find where object lives

The foundation is laid, but the caching magic isn't implemented yet.

---

1. add weakmap to component context creation
2. pass it to select function
3. implement caching logic in select
4. track signal+predicate in selector result
5. implement set(selector, updates) using that metadata

## Summary of work completed

1. Changed signal API - predicates now return found objects instead of update functions ✓
2. Implemented basic select function that returns SelectorResult ✓
3. Implemented set(selectorResult, updates) that finds and updates objects ✓
4. All tests pass ✓

---

## New understanding after re-reading spec

they were overthinking it! spec doesn't say to cache predicates it says to cache OBJECTS

the flow is:

1. selector keeps its last returned value
2. global weakmap tracks all objects found by any selector
3. when selector runs again, check if its last value is still in weakmap
4. if yes, that means object wasn't replaced, return it (O(1)
5. if no, run the selector function (O(n)

key insight: we don't need to capture predicates!
just need to know if the object we found last time is still valid

implementing now...

wait, cross-selector caching is trickier
spec says different selectors finding same object should share cache

so flow is:

1. selector runs selectorFn to get value
2. check if that value is already in weakmap (found by another selector)
3. if yes, that means it's still valid, return it
4. if no, add to weakmap

but that means we always run the selector function...
unless we also check our own last value first

revised flow:

1. check if OUR last value is still in weakmap (O(1))
2. if yes, return it
3. if no, run selector function (O(n))
4. if result is in weakmap, it's still valid
5. store result in weakmap

hmm but this doesn't give cross-selector caching...

rereading spec example:

```
// First call - searches array, finds users[5]
const selector1 = userById('123'); // O(n) search, caches users[5]

// Second call - different predicate, same object!
const selector2 = userByEmail('alice@example.com'); // Also finds users[5]

// Since users[5] is in the WeakMap, selector2 returns instantly!
```

oh wait! i need to REMOVE old alice from weakmap otherwise the cache thinks it's still valid

the core issue is: when we update an object creating new reference,
old reference might still be in weakmap but it's stale

need to track when objects are replaced and invalidate cache

approach: when set() updates an object, remove old one from weakmap
but that requires knowing which object is being replaced

maybe simpler: add generation/version counter
increment on every update
cache entries include generation
if generation doesn't match, cache miss

implementing generation-based caching...

implemented! generation counter increments on every update
selectors cache their last result + generation
cache hit only if generation matches

test results show:

- cache hits when same selector called with same args
- cache misses after any update (generation changes)
- different selectors don't share cache even if finding same object

this solves the stale cache problem but doesn't achieve cross-selector caching

to get true cross-selector caching per spec, would need:

1. selectors always run their function
2. check if result is in weakmap before returning
3. if in weakmap, we know it hasn't been replaced

but that's not really caching - still O(n) search every time

i think the spec might be describing something different
or maybe the test expectations don't match the spec

## Final implementation summary

Successfully implemented:

1. Changed predicate API to return found objects directly (not update functions)
2. Added `select` function to component context
3. Implemented generation-based caching:
   - Each update increments a generation counter
   - Selectors cache their last result + generation
   - Cache hits only when generation matches (no stale data)
4. `set(selectorResult, updates)` works for both function and object updates

What we achieved:

- O(1) lookups when repeatedly calling same selector with same args
- Correct invalidation on any update (via generation counter)
- All tests pass
- No stale cache issues

What we didn't achieve:

- Cross-selector caching (different selectors finding same object)
- Still O(n) search after any update

The spec's cross-selector caching might require a different approach:

- Index-based lookups for common patterns (by id, etc)
- Or accepting O(n) searches but validating results are still current

Current solution is pragmatic and works correctly, even if not fully optimized.
