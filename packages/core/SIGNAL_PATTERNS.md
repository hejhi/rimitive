# Signal Patterns & Best Practices

This guide demonstrates optimal patterns for using signals within Lattice components.

## Key Principles

1. **Direct signal updates are preferred for single property changes** - They're more performant than going through `store.set()`
2. **Use `store.set()` for batched updates** - When updating multiple properties that should trigger effects once
3. **Leverage signal methods for nested updates** - `signal.set()` and `signal.patch()` for objects/arrays
4. **Subscribe to individual signals** - For fine-grained reactivity
5. **Use `select` for computed tracking** - React only to specific property changes

## Performance Patterns

### Single Property Updates

```typescript
// ✅ BEST: Direct signal update
store.state.count.value++;

// ❌ AVOID: Using store.set for single property
store.set({ count: store.state.count.value + 1 });
```

### Multiple Property Updates

```typescript
// ✅ BEST: Batched update with store.set
store.set({
  activeUsers: 100,
  totalRevenue: 50000,
  lastRefresh: Date.now()
});

// ❌ AVOID: Multiple direct updates (triggers effects multiple times)
store.state.activeUsers.value = 100;
store.state.totalRevenue.value = 50000;
store.state.lastRefresh.value = Date.now();
```

### Nested Object Updates

```typescript
// ✅ BEST: Use signal.set for single property
store.state.todos.set(0, { ...todo, done: true });

// ✅ BEST: Use signal.patch for partial updates
store.state.todos.patch(0, { done: true });

// ❌ AVOID: Recreating entire array for single item update
store.state.todos.value = store.state.todos.value.map((t, i) => 
  i === 0 ? { ...t, done: true } : t
);
```

## Subscription Patterns

### Fine-Grained Subscriptions

```typescript
// Subscribe to individual signals
const unsubscribe = store.state.username.subscribe(() => {
  console.log('Username changed');
});

// Use select for property-level subscriptions
const nameSelect = store.state.user.select(u => u.name);
const unsubName = nameSelect.subscribe(() => {
  console.log('User name changed');
});
```

## Component Patterns

### Basic Component Structure

```typescript
const Counter: Component<CounterState, CounterAPI> = (store) => {
  return {
    // Getters for reactive values
    get count() { return store.state.count.value; },
    
    // Direct updates for performance
    increment: () => store.state.count.value++,
    
    // Batched updates when needed
    reset: () => store.set({ count: 0, lastReset: Date.now() })
  };
};
```

### Component with Computed Values

```typescript
const ShoppingCart: Component<CartState, CartAPI> = (store) => {
  const ctx = store.getContext();
  
  // Computed values access signals directly
  const total = ctx.computed(() => {
    const items = store.state.items.value;
    return items.reduce((sum, item) => sum + item.price, 0);
  });
  
  return {
    get total() { return total.value; },
    addItem: (item) => {
      // Direct array update
      store.state.items.value = [...store.state.items.value, item];
    }
  };
};
```

## When to Use Each Pattern

| Pattern | Use When |
|---------|----------|
| Direct signal update (`signal.value = x`) | Updating a single property |
| Store set (`store.set({ ... })`) | Updating multiple related properties |
| Signal set (`signal.set(key, value)`) | Updating object property or array element |
| Signal patch (`signal.patch(key, partial)`) | Partial update of nested object |
| Individual subscriptions | Need to react to specific signal changes |
| Select subscriptions | Need to react to object property changes |

## Anti-Patterns to Avoid

```typescript
// ❌ Using store.set for single updates
store.set({ count: store.state.count.value + 1 });

// ❌ Multiple direct updates that should be batched
store.state.firstName.value = 'John';
store.state.lastName.value = 'Doe';
store.state.fullName.value = 'John Doe';

// ❌ Recreating objects unnecessarily
store.state.user.value = { ...store.state.user.value, name: 'John' };
// ✅ Use signal.patch instead
store.state.user.patch('name', 'John');
```