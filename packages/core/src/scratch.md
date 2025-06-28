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
