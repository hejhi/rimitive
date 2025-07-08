# Reactivity Boundaries & Getter Patterns

## Key Concept: Getters Create Reactive Boundaries

When you use a getter pattern like:
```typescript
get count() { return store.state.count.value; }
```

This has important implications for reactivity:

1. **The getter is reactive** - Each access reads the signal value
2. **Effects track through getters** - If an effect calls `component.count`, it tracks the signal
3. **The boundary is at access time** - Not at component creation time

## Patterns & Implications

### ✅ Reactive Getter Pattern (Recommended)

```typescript
const Counter = (store) => {
  return {
    // Reactive - each access reads current signal value
    get count() { return store.state.count.value; },
    
    // Also reactive - computed value is accessed through getter
    get doubled() { return doubledComputed.value; }
  };
};

// Effects will re-run when signals change
effect(() => {
  console.log(counter.count); // Tracks count signal
});
```

### ❌ Static Value Pattern (Avoid)

```typescript
const Counter = (store) => {
  // NOT reactive - value captured at creation time
  const count = store.state.count.value;
  
  return {
    count: count, // Static value!
  };
};

// Effects won't re-run - not tracking any signals
effect(() => {
  console.log(counter.count); // Just a static number
});
```

## Computed Creation Timing

### ✅ Create Computed Once (Good)

```typescript
const Component = (store) => {
  const ctx = store.getContext();
  
  // Computed created once during component creation
  const total = ctx.computed(() => 
    store.state.items.value.reduce((a, b) => a + b, 0)
  );
  
  return {
    get total() { return total.value; }
  };
};
```

### ❌ Create Computed in Getter (Bad)

```typescript
const Component = (store) => {
  const ctx = store.getContext();
  
  return {
    // Creates new computed on EVERY access!
    get total() {
      const computed = ctx.computed(() => 
        store.state.items.value.reduce((a, b) => a + b, 0)
      );
      return computed.value;
    }
  };
};
```

## Signal Tracking Granularity

When you access nested properties through getters, you track the **entire signal**:

```typescript
const Component = (store) => {
  return {
    // Both getters track the same user signal
    get userName() { return store.state.user.value.name; },
    get userAge() { return store.state.user.value.age; }
  };
};

// Effect runs when ANY property of user changes
effect(() => {
  console.log(component.userName); // Tracks entire user signal
});

// Changing age triggers the effect even though it only accesses name
store.state.user.value = { ...store.state.user.value, age: 31 };
```

## Fine-Grained Reactivity with Select

Use `select` for property-level tracking:

```typescript
// Only tracks changes to the name property
const nameSelect = store.state.user.select(u => u.name);

nameSelect.subscribe(() => {
  console.log('Name changed!');
});

// Update age - subscription doesn't fire
store.state.user.value = { ...store.state.user.value, age: 31 };

// Update name - subscription fires
store.state.user.value = { ...store.state.user.value, name: 'Jane' };
```

## Best Practices

1. **Use getters for reactive values** - They maintain reactivity boundaries
2. **Create computed values once** - During component initialization
3. **Use select for fine-grained tracking** - When you only care about specific properties
4. **Avoid capturing values** - Unless you explicitly want static values

## Summary

The getter pattern (`get property()`) is essential for maintaining reactivity in Lattice components. It ensures that:
- Values are always fresh when accessed
- Effects can track dependencies properly
- The reactive system works as expected

This is why the component pattern uses getters for all reactive values - it preserves the signal reactivity chain from store to consumer.