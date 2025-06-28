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

### 5. Next steps needed:

1. Implement WeakMap caching in select function
2. Make set(selectorResult, updates) actually work
3. Add cross-selector caching as per spec
4. Create tests for caching behavior
5. Performance benchmarks

### 6. Key insight from spec:

- Cache objects by reference in WeakMap
- Different selectors finding same object share cache
- Leverages immutable update patterns

### 7. Implementation approach:

- Component-level WeakMap<object, SelectorMetadata>
- When selector runs, check if object in WeakMap first
- For set(), search all signals to find where object lives

### 8. Current select implementation:

```typescript
const select = <TArgs extends any[], TResult>(
  selectorFn: (...args: TArgs) => TResult | undefined
) => {
  return (...args: TArgs): SelectorResult<TResult> => {
    const value = selectorFn(...args);
    return {
      __selector: true,
      value,
      signal: null, // TODO
      predicate: () => true, // TODO
    };
  };
};
```

### 9. Current set implementation:

```typescript
if (isSelectorResult(arg1)) {
  const selector = arg1;
  const updates = arg2;

  if (!selector.value) return;

  // TODO: Find object in signals and update
  console.warn('Selector-based updates not fully implemented yet');
  return;
}
```

### 10. Test pattern for new API:

```typescript
// Old:
const update = store.users((u) => u.id === id);
update((u) => ({ ...u, name: 'new' }));

// New:
const user = store.users((u) => u.id === id);
if (user) {
  const users = store.users();
  const index = users.findIndex((u) => u.id === id);
  if (index >= 0) {
    const updated = [...users];
    updated[index] = { ...user, name: 'new' };
    store.users(updated);
  }
}
```

The foundation is laid, but the caching magic isn't implemented yet.

---

## Current analysis (reviewing the work)

looks like they successfully changed predicate api to return objects
tests are passing which is good
but the hard parts aren't done:
- no weakmap caching in select
- set(selectorResult) doesn't work - just warns
- no cross-selector caching
- signal/predicate metadata not tracked in selector result

key challenge: how does set() know where an object lives in signals?
need to either:
1. track signal+index when finding object
2. search all signals when updating (slow)
3. attach metadata to objects (invasive)

thinking option 1 is best - selector result should know signal+predicate

next: implement weakmap caching in createLatticeContext
need component-level cache that all selectors share

wait, spec says cache at component level but select is in lattice context
maybe cache should be in createStore? or passed to select factory?

actually component context has access to store signals
so cache should probably be there

ok plan:
1. add weakmap to component context creation
2. pass it to select function
3. implement caching logic in select
4. track signal+predicate in selector result
5. implement set(selector, updates) using that metadata

update: implemented basic caching but hitting issue
test shows update by email not working
problem might be predicate stored is (item) => item === value
but that won't work after object is updated with spread
need to store original predicate or better search strategy

actually wait, the issue is more fundamental
when we update alice to have age 26, we create new object
so cache is invalidated
then lookup by email has to search again (o(n))
and it finds the NEW alice object
so cache is working correctly!

but the update by email is failing
let me check why...

oh i see the issue!
when we cache, we store predicate as (item) => item === value
but that looks for exact object reference
after update, alice is new object
so that predicate won't find new alice

we need to capture the ORIGINAL predicate used
not create a reference-based one

problem: select calls selectorFn which calls store.users(predicate)
by the time we get the result, we've lost the predicate

solution ideas:
1. make signal return {value, predicate} - too invasive
2. track last predicate in signal - global state, bad
3. parse the selector function - complex and fragile
4. wrap store signals in select - this might work!

let me try approach 4...

wait, rereading the test...
after updateUserById, alice is a new object
so updateUserByEmail needs to find NEW alice (which it does)
but then the update fails

i think the issue is simpler - we haven't implemented selector-based updates yet!
the component.ts just has a console.warn

let me implement the actual update logic

ok implemented basic selector updates - tests pass now
but no caching yet

current status:
- selector returns found object ✓
- set(selector, updates) works ✓  
- but it's O(n) every time - no cache

need to implement the weakmap caching
challenge: how to capture the predicate that found the object?

the spec example shows:
```
const userById = select((id: string) => 
  store.users((user) => user.id === id)
);
```

when userById('123') runs:
1. the select wrapper should check cache first
2. if not cached, run selector function
3. selector function calls store.users(predicate)
4. store.users returns the found object
5. but we've lost the predicate!

maybe i need to rethink this...
what if select wraps the store to intercept predicate calls?

## Summary of work completed

1. Changed signal API - predicates now return found objects instead of update functions ✓
2. Implemented basic select function that returns SelectorResult ✓
3. Implemented set(selectorResult, updates) that finds and updates objects ✓
4. All tests pass ✓

What's NOT implemented yet:
- WeakMap caching for O(1) lookups
- Cross-selector caching (different selectors finding same object)
- Capturing original predicates for proper cache invalidation

The main blocker is architectural - we need a way to capture the predicate
used inside store.users() when called from a selector. Options:
1. Make signals return {value, predicate} - too invasive
2. Wrap store in select to intercept calls - complex
3. Use a different API that makes predicates explicit

Current implementation is functional but O(n) for every lookup.
The caching optimization can be added later without breaking the API.
