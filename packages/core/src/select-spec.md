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

## Solution: `select` with Computed Indexes

Use `computed` to build reactive indexes, then `select` to query them. This provides true O(1) lookups without complex caching.

### API

```typescript
const UserStore = createComponent(
  withState<{ users: User[] }>(),
  ({ store, select, computed, set }) => {
    // Build reactive indexes using computed - O(n) once, then cached
    const usersById = computed(() =>
      new Map(store.users().map(user => [user.id, user]))
    );
    
    const usersByEmail = computed(() =>
      new Map(store.users().map(user => [user.email, user]))
    );
    
    // Create selectors that use the indexes - always O(1)!
    const userById = select((id: string) => 
      usersById().get(id)
    );
    
    const userByEmail = select((email: string) =>
      usersByEmail().get(email)
    );

    return {
      // Export selectors for direct use
      userById,
      userByEmail,
      
      // All lookups are now O(1)!
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

1. **Computed Indexes**: `computed` creates reactive Maps that rebuild when source data changes
2. **O(1) Lookups**: Map.get() provides constant-time access by key
3. **Automatic Updates**: When users array changes, computed rebuilds the index
4. **Reference Stability**: Objects maintain same reference until explicitly updated
5. **No Complex Caching**: Leverages existing computed caching mechanism

### The Key Pattern: Index Once, Lookup Many

```typescript
const UserStore = createComponent(
  withState<{ users: User[] }>(),
  ({ store, select, computed, set }) => {
    // Create index ONCE at component initialization
    const usersById = computed(() => 
      new Map(store.users().map(u => [u.id, u]))
    );

    const userById = select((id: string) => usersById().get(id));

    return {
      userById,
      
      // All methods get O(1) lookups
      getUser: (id: string) => userById(id).value,
      
      updateUser: (id: string, updates: Partial<User>) => {
        set(userById(id), updates); // O(1) lookup!
      },
      
      deleteUser: (id: string) => {
        const user = userById(id); // O(1) lookup!
        if (user.value) {
          set({ users: store.users().filter(u => u.id !== id) });
        }
      }
    };
  }
);

// Every lookup is O(1) from the Map
const user = store.userById('123');
store.updateUser('123', { name: 'Updated' });
const sameUser = store.userById('123'); // Still O(1)!

// After array changes, index auto-rebuilds
store.users([...store.users(), newUser]);
const anotherUser = store.userById('456'); // Still O(1) from new index!
```

### Performance Characteristics

```typescript
// Without indexes - O(n) for every lookup
store.users((u) => u.id === '123'); // Searches all users
store.users((u) => u.id === '456'); // Searches all users again

// With computed indexes - O(1) for every lookup!
const usersById = computed(() => 
  new Map(store.users().map(u => [u.id, u]))
);

usersById().get('123'); // Direct map access
usersById().get('456'); // Direct map access

// Index rebuild is O(n) but only happens when users array changes
store.users([...store.users(), newUser]); // Triggers index rebuild
usersById().get('789'); // Still O(1) from rebuilt index

// Compare approaches:
// ❌ Predicate search: O(n) × number of lookups
// ✅ Computed index: O(n) once + O(1) × number of lookups
```

### Common Patterns

```typescript
// Single-value indexes for unique lookups
const usersById = computed(() => 
  new Map(store.users().map(u => [u.id, u]))
);

// Multi-value indexes for one-to-many relationships
const usersByRole = computed(() => {
  const map = new Map<string, User[]>();
  for (const user of store.users()) {
    const list = map.get(user.role) || [];
    list.push(user);
    map.set(user.role, list);
  }
  return map;
});

// Compound key indexes
const usersByCompoundKey = computed(() => 
  new Map(store.users().map(u => [`${u.companyId}-${u.departmentId}`, u]))
);

// Set indexes for existence checks
const userIdSet = computed(() => 
  new Set(store.users().map(u => u.id))
);

const hasUser = select((id: string) => userIdSet().has(id));
```

### Implementation Notes

- `select` is a simple wrapper that returns SelectorResult for `set` compatibility
- No complex caching needed - computed handles all caching
- Indexes rebuild automatically when dependencies change
- Object references are preserved (same object in array = same object in Map)
- Memory usage: O(n) for each index (same as the source array)

### Benefits

1. **True O(1) Performance**: Map lookups are always constant time
2. **Simple Implementation**: No caching logic needed in select
3. **Leverages Existing APIs**: computed + select work together naturally
4. **Type Safe**: Full TypeScript inference for Map types
5. **Predictable Memory**: Index size = source array size

### NO Backwards Compatibility

There is no migration. we are pre-launch and have no users, so we do NOT need to worry about breaking existing users code.

### Best Practices

1. **Create indexes at component initialization** using computed
2. **Choose appropriate data structures** (Map for lookups, Set for existence)
3. **Name indexes clearly** (e.g., `usersById`, `usersByRole`)
4. **Keep indexes simple** - one index per access pattern
5. **Let computed handle caching** - don't add your own

### Reactive Patterns

Everything composes naturally since indexes are just computed values:

```typescript
const UserDashboard = createComponent(
  withState<{ users: User[]; currentUserId: string }>(),
  ({ store, select, computed, set }) => {
    // Create index
    const usersById = computed(() => 
      new Map(store.users().map(u => [u.id, u]))
    );
    
    const userById = select((id: string) => usersById().get(id));

    return {
      userById,
      
      // Reactive current user - auto-updates when users OR currentUserId change
      currentUser: computed(() => 
        usersById().get(store.currentUserId())
      ),
      
      // Derived values stay reactive
      currentUserName: computed(() => 
        usersById().get(store.currentUserId())?.name || 'Anonymous'
      ),
      
      isCurrentUserAdmin: computed(() => 
        usersById().get(store.currentUserId())?.role === 'admin'
      ),
      
      // Updates work seamlessly
      promoteCurrentUser: () => {
        const userId = store.currentUserId();
        set(userById(userId), { role: 'admin' });
      }
    };
  }
);

// Everything stays reactive!
store.currentUserName(); // "Alice"
store.currentUserId('456');
store.currentUserName(); // "Bob" - automatically updated!
```

Key benefits:
- Indexes are reactive and auto-update
- All lookups are O(1)
- Natural composition with computed
- No special caching logic needed

### Edge Cases

- Empty arrays produce empty Maps/Sets
- Duplicate keys in Map use last value (standard Map behavior)
- Undefined/null values can be used as Map keys if needed
- Very large arrays may have memory impact (consider virtualization)

### Next Steps

1. Simplify `select` implementation (remove caching)
2. Update documentation to show computed index pattern
3. Add examples of common index patterns
4. Performance benchmarks comparing approaches
5. Consider helper functions for common index types
