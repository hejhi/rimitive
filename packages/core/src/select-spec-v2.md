# Unified Signal API Spec v2

## Problem

Currently we have inconsistent APIs:
- Regular signals can be updated directly: `store.users(newArray)`
- Signal predicates return values directly: `store.users(u => u.id === '123')` returns the user, not a signal
- Selectors via `select()` are read-only, updated via `set()` but require O(n) search on each update
- Adapter-based stores create read-only wrapper signals, updated via `set()`

This creates confusion and special cases throughout the codebase.

## Solution

**All signals are read-only and can only be updated through `set()`**. Signals can create derived signals with predicates.

## Core API

```typescript
// Reading
store.users() // Returns User[]
store.name() // Returns string

// Writing (all through set)
set(store.users, newArray)
set(store.name, 'New Name')

// Derived signals with predicates
const user = store.users(u => u.id === '123')
user() // Returns User | undefined
set(user, { name: 'Updated' }) // O(1) update when cached

// Parameterized selectors
const userById = store.users(
  (id: string) => id,                    // Key function
  (user, key) => user.id === key        // Predicate
);
set(userById('123'), { name: 'Updated' })

// Works with all collection types
const setting = store.config(([key]) => key === 'theme') // Objects
const cached = store.cache(([id]) => id === 'user:123') // Maps
const tag = store.tags(t => t.name === 'important') // Sets
```

## Key Principles

1. **No direct writes** - Everything goes through `set()`
2. **No chaining** - Can't create derived signals from derived signals
3. **Cached lookups** - Derived signals cache their position for O(1) updates
4. **Universal** - Works with Arrays, Objects, Maps, and Sets

## Usage Patterns

```typescript
// Static queries
const activeUsers = store.users(u => u.active);

// Parameterized queries (cached by key)
const userById = store.users(
  (id: string) => id,
  (user, id) => user.id === id
);

// Dynamic queries (use computed)
const currentUserId = signal('123');
const currentUser = computed(() => 
  store.users().find(u => u.id === currentUserId())
);
```

## Implementation Notes

- Derived signals maintain a reference to their source and predicate
- Version tracking enables cache invalidation when source changes
- Keyed selectors cache derived signals by key for efficiency
- Set updates find items via predicate and update immutably
- Cache entries store only current references, not historical values - when a key's result changes, the cache is simply updated

## Breaking Changes

1. **No more direct signal writes**: `signal(value)` → `set(signal, value)`
2. **Predicates return signals, not values**: `signal(predicate)` now returns a derived signal instead of the found value
3. **No chaining derived signals**: Keeps implementation simple
4. **Unified behavior**: Regular stores and adapter stores work identically

## Benefits

- **Consistent API** across all store types
- **Performance** with O(1) cached updates
- **Type safety** throughout
- **Simplicity** with single write path

## Open Questions

### Memory Management
- Keyed selectors cache derived signals indefinitely. Consider: WeakMap? LRU cache? Max cache size?
- What's the memory overhead per derived signal?
- When should cached entries be cleared?

### Error Handling
- What happens when `set()` is called on a derived signal with no match?
- How to handle predicates that throw errors?
- Type mismatch handling between updates and existing values?

### Performance Characteristics
- Document cost of creating derived signals
- When to use computed vs derived signals (guidance needed)
- Behavior with deeply nested collections

### Implementation Details
- How do derived signals interact with batched updates?
- Debugging story - how to inspect derived signal chains?
- Testing utilities for components using this pattern
- Null/undefined handling in predicates
- Concurrent updates to same item