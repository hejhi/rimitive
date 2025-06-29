# Select API Spec

## Problem

Right now, predicate-based lookups have O(n) performance every time:

```typescript
// This searches through ALL users three times!
const user1 = store.users((user) => user.id === '123');
set(store.users((user) => user.id === '123'), { name: 'Alice' });
set(store.users((user) => user.id === '123'), { age: 25 });
```

This doesn't scale. We need better performance through selector reuse.

## Solution: `select`

Add a `select` function to the component context that creates cached selectors for predicate-based lookups.

### API

```typescript
const UserStore = createComponent(
  withState<{ users: User[] }>(),
  ({ store, select, set }) => {
    // Create reusable cached selectors
    const userById = select((id: string) =>
      store.users((user) => user.id === id)
    );
    
    const userByEmail = select((email: string) =>
      store.users((user) => user.email === email)
    );

    return {
      // Export selectors for direct use
      userById,
      userByEmail,
      
      // Reuse selectors in methods - O(1) after first call!
      updateUser: (id: string, updates: Partial<User>) => {
        set(userById(id), updates);
      },

      promoteUser: (id: string) => {
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

1. **Selector-Level Caching**: Each selector caches its results based on the arguments passed
2. **Generation Tracking**: A global generation counter increments on every update
3. **Cache Validation**: Selectors check if their cached result is from the current generation
4. **Automatic Invalidation**: Any update invalidates all selector caches via generation increment
5. **Reference Stability**: Objects maintain same reference until explicitly updated

### The Key Pattern: Selector Reuse

```typescript
const UserStore = createComponent(
  withState<{ users: User[] }>(),
  ({ store, select, set }) => {
    // Create selectors ONCE
    const userById = select((id: string) => 
      store.users((user) => user.id === id)
    );

    return {
      userById,
      
      // Multiple methods reuse the SAME selector
      getUser: (id: string) => userById(id),
      
      updateUser: (id: string, updates: Partial<User>) => {
        set(userById(id), updates); // Reuses cached result!
      },
      
      deleteUser: (id: string) => {
        const user = userById(id); // Reuses cached result!
        // ... deletion logic
      }
    };
  }
);

// First call - O(n) search
const user = store.userById('123');

// All subsequent uses of same selector+args - O(1)!
store.updateUser('123', { name: 'Updated' }); // Cache hit!
const sameUser = store.getUser('123'); // Cache hit!
```

### Performance Characteristics

```typescript
// First search with selector - O(n)
const user1 = store.userById('123');

// Same selector, same args - O(1) from cache!
const user2 = store.userById('123');
store.updateUser('123', { age: 25 }); // Still O(1)!

// Different selector = different cache - O(n) first time
const user3 = store.userByEmail('alice@example.com');

// But now that selector is also cached for its args
const user4 = store.userByEmail('alice@example.com'); // O(1)!

// After any update, generation increments and caches invalidate
store.users([...store.users(), newUser]);

// Next lookup must search again - O(n)
const user5 = store.userById('123');
// But subsequent calls are cached again - O(1)
const user6 = store.userById('123');
```

### What DOESN'T Work

```typescript
// Creating selectors inline = no caching benefit!
updateUser: (id: string) => {
  const user = store.users(u => u.id === id); // O(n) every time!
  // ...
}

// Different selectors don't share cache
const byId = store.userById('123'); // O(n) 
const byEmail = store.userByEmail('alice@example.com'); // O(n) - can't know it's same user
```

### Implementation Notes

- Each selector maintains its own cache keyed by arguments
- Generation counter ensures cache validity across updates
- WeakMap stores found objects with their generation
- Cache hits only when generation matches current
- Encourages creating reusable selectors rather than inline lookups

### Benefits

1. **Predictable Performance**: Same selector + same args = O(1) after first call
2. **Zero Configuration**: Just wrap lookups with `select()`
3. **Memory Safe**: WeakMap allows garbage collection
4. **Encourages Good Patterns**: Reusable selectors over scattered lookups
5. **Simple Mental Model**: "Create once, reuse everywhere"

### NO Backwards Compatibility

There is no migration. we are pre-launch and have no users, so we do NOT need to worry about breaking existing users code.

### Best Practices

1. **Create selectors at component initialization**, not in methods
2. **Export selectors** from your store for external use
3. **Compose selectors** with `set()` for updates
4. **Name selectors clearly** (e.g., `userById`, `activeUsers`)
5. **Avoid inline predicates** - they bypass caching entirely

### Reactive Patterns with Selectors

Selectors compose naturally with `computed` for reactive behavior:

```typescript
const UserDashboard = createComponent(
  withState<{ users: User[]; currentUserId: string }>(),
  ({ store, select, computed, set }) => {
    // Create reusable selector
    const userById = select((id: string) => 
      store.users((user) => user.id === id)
    );

    return {
      // Export the selector
      userById,
      
      // Reactive computed using selector - auto-updates when users change!
      currentUser: computed(() => {
        const result = userById(store.currentUserId());
        return result.value;
      }),
      
      // Derived reactive values
      currentUserName: computed(() => {
        const result = userById(store.currentUserId());
        return result.value?.name || 'Anonymous';
      }),
      
      isCurrentUserAdmin: computed(() => {
        const result = userById(store.currentUserId());
        return result.value?.role === 'admin';
      }),
      
      // Methods can use reactive values
      promoteCurrentUser: () => {
        const userId = store.currentUserId();
        set(userById(userId), { role: 'admin' });
      }
    };
  }
);

// Usage - reactive values auto-update!
store.currentUserName(); // "Alice"
store.users([...store.users(), { id: 'current', name: 'Bob' }]);
store.currentUserName(); // "Bob" - automatically updated!
```

Key benefits:
- Selectors provide efficient lookups (O(1) after first call)
- Computeds provide reactivity and dependency tracking
- Natural composition without special APIs
- Shared selectors across multiple reactive computeds

### Edge Cases

- Selectors returning primitives still work but can't benefit from reference equality
- Deeply nested updates invalidate all caches (generation increments)
- Each unique selector function creates its own cache namespace

### Next Steps

1. Implement `select` in lattice-context
2. Enhance `set` to work with selectors
3. Add tests for caching behavior
4. Performance benchmarks vs current approach
5. Documentation and examples
