# Select API Spec

## Problem

Right now, predicate-based updates have O(n) performance every time:

```typescript
// This searches through ALL users twice
store.users((user) => user.id === '123')({ name: 'Alice' });
store.users((user) => user.id === '123')({ age: 25 }); // Same search again!
```

This doesn't scale. We need MobX-level performance without the complexity.

## Solution: `select`

Add a `select` function to the component context that creates cached selectors for predicate-based lookups.

### API

```typescript
const UserStore = createComponent(
  withState<{ users: User[] }>(),
  ({ store, select, set }) => {
    // Create a cached selector
    const userById = select((id: string) =>
      store.users((user) => user.id === id)
    );

    return {
      updateUser: (id: string, updates: Partial<User>) => {
        // Use with set - cached lookup!
        set(userById(id), updates);
      },

      promoteUser: (id: string) => {
        // Works with function updates too
        set(userById(id), (user) => ({
          ...user,
          role: 'admin',
          promotedAt: Date.now(),
        }));
      },
    };
  }
);
```

### How It Works

1. **Object-Based Caching**: When a selector runs, it stores the returned object (object/array/map/set/etc, cannot "select" primitives) in a WeakMap, as well as at the selector level itself.
2. **Reference Equality**: when the selector runs again, before it executes its actual selector function, it checks if the previous value is present in the WeakMap, and if so, returns it instantly (as if it's present, it means it wasn't updated)
3. **Signal Agnostic**: Selectors don't care about signals - they just cache object references
4. **Automatic Cleanup**: WeakMap ensures garbage collection when objects are removed

### The Magic

```typescript
// Component-level WeakMap for all found objects
const foundObjectsCache = new WeakMap<object, SelectorMetadata>();

const userById = select((id: string) => store.users((user) => user.id === id));

// First call - searches array, finds users[5]
const selector1 = userById('123'); // O(n) search, caches users[5]

// Second call - different predicate, same object!
const selector2 = userByEmail('alice@example.com'); // Also finds users[5]

// Since users[5] is in the WeakMap, selector2 returns instantly!
set(selector2, { active: false }); // O(1)!
```

### Performance Characteristics

```typescript
// First search for user - O(n)
set(userById('123'), { name: 'Alice' });

// Same user, same selector - O(1)
set(userById('123'), { age: 25 });

// Same user, DIFFERENT selector - still O(1)!
set(userByEmail('alice@example.com'), { verified: true });

// After immutable update that preserves references
store.users((users) =>
  users.map(
    (u) => (u.id === '456' ? { ...u, name: 'Bob' } : u) // alice's reference unchanged
  )
);

// Alice lookups still O(1) because her object reference is the same!
set(userById('123'), { lastSeen: Date.now() });
```

### Implementation Notes

- Each selector stores its last result internally and in the WeakMap
- Global WeakMap stores all found objects → selector metadata
- When selector runs, check previous value against WeakMap first
- Only works with object types (not primitives)
- Leverages React/Vue best practices of preserving references

### Benefits

1. **Cross-Selector Caching**: Different selectors finding same object share cache
2. **Zero Configuration**: Just works with immutable update patterns
3. **Memory Safe**: WeakMap allows garbage collection
4. **Framework Aligned**: Rewards proper React/Vue patterns
5. **Simple Mental Model**: "Same object = instant lookup"

### NO Backwards Compatibility

There is no migration. we are pre-launch and have no users, so we do NOT need to worry about breaking existing users code.

### Edge Cases

A user could have one selector selecting deeper than another. That _should_ be ok, as we're doing controlled mutations at different levels. Which means if a child property changes, and the parent property returns, it should return the most up-to-date child property as well. changes to parents will cause the whole state tree to re-run.

### Next Steps

1. Implement `select` in lattice-context
2. Enhance `set` to work with selectors
3. Add tests for caching behavior
4. Performance benchmarks vs current approach
5. Documentation and examples
