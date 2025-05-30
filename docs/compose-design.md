# Compose Syntax Recommendation for Lattice

## Executive Summary

After analyzing multiple approaches, I recommend implementing **selector composition** as the primary compose pattern for Lattice, with **slice factory composition** as a secondary pattern for advanced use cases.

## Recommended Implementation

### Primary: Selector Composition

```typescript
export function compose<Model>(
  ...selectors: Array<(model: Model) => any>
): (model: Model) => any {
  return (model: Model) => {
    return selectors.reduce((acc, selector) => {
      const result = selector(model);
      return { ...acc, ...result };
    }, {} as any);
  };
}
```

**Usage:**
```typescript
const slice = createSlice(
  model,
  compose(
    (m) => ({ count: m.count }),
    (m) => ({ increment: m.increment }),
    (m) => ({ name: m.name })
  )
);
```

### Secondary: Slice Factory Composition

```typescript
export function composeSlices<Model>(
  ...slices: Array<SliceFactory<Model, any>>
): SliceFactory<Model, any> {
  return createSlice(
    null as any,
    (model: Model) => {
      return slices.reduce((acc, slice) => {
        const result = slice(model);
        return { ...acc, ...result };
      }, {} as any);
    }
  );
}
```

**Usage:**
```typescript
const stateSlice = createSlice(model, (m) => ({ count: m.count }));
const actionsSlice = createSlice(model, (m) => ({ increment: m.increment }));
const composed = composeSlices(stateSlice, actionsSlice);
```

## Why These Approaches?

### Selector Composition Benefits

1. **Zero Breaking Changes**: Works with existing API
2. **Simple Mental Model**: Compose functions before creating slice
3. **TypeScript Friendly**: Excellent type inference with overloads
4. **Minimal Implementation**: ~10 lines of code
5. **Consistent with Lattice Philosophy**: Slices are still the primitive

### Slice Factory Composition Benefits

1. **Modular Composition**: Combine slices from different modules
2. **Preserves Capabilities**: Transforms still work on composed slices
3. **Advanced Use Cases**: Enables library authors to build reusable slice patterns

## Implementation Plan

### Phase 1: Core Implementation
```typescript
// Add to packages/core/src/index.ts
export { compose, composeSlices } from './compose';

// Create packages/core/src/compose.ts
// (Implementation from compose-implementation.ts)
```

### Phase 2: Documentation
```typescript
// Example: Composing UI Behavior
const createButton = (model) => createSlice(
  model,
  compose(
    (m) => ({ onClick: m.handleClick }),
    (m) => ({ disabled: m.isLoading }),
    (m) => ({ 'aria-busy': m.isLoading })
  )
);

// Example: Modular Composition
const formSlices = {
  validation: createSlice(model, (m) => ({ errors: m.errors })),
  submission: createSlice(model, (m) => ({ onSubmit: m.submit })),
  status: createSlice(model, (m) => ({ isSubmitting: m.isSubmitting }))
};

const formSlice = composeSlices(...Object.values(formSlices));
```

### Phase 3: Advanced Patterns
```typescript
// Conditional composition
const conditionalCompose = <Model>(
  ...entries: Array<[boolean, (model: Model) => any]>
) => {
  const activeSelectors = entries
    .filter(([condition]) => condition)
    .map(([, selector]) => selector);
  return compose(...activeSelectors);
};

// Usage
const slice = createSlice(
  model,
  conditionalCompose(
    [includeActions, (m) => ({ increment: m.increment })],
    [includeState, (m) => ({ count: m.count })],
    [includeDebug, (m) => ({ debug: m.debugInfo })]
  )
);
```

## Type Safety Guarantees

### With Overloads (Recommended)
```typescript
// Provides exact type inference for up to 4 selectors
export function compose<Model, T1, T2>(
  selector1: (model: Model) => T1,
  selector2: (model: Model) => T2
): (model: Model) => T1 & T2;
// ... more overloads
```

### Property Conflicts
- **Behavior**: Last selector wins (consistent with Object.assign)
- **Documentation**: Clear examples showing conflict resolution
- **Future**: Consider runtime warnings in development mode

## Migration Path

### For Existing Code
```typescript
// Before
const slice = createSlice(model, (m) => ({
  count: m.count,
  increment: m.increment,
  name: m.name,
  // ... many more properties
}));

// After
const slice = createSlice(
  model,
  compose(
    (m) => ({ count: m.count }),
    (m) => ({ increment: m.increment }),
    (m) => ({ name: m.name })
    // Easier to read and maintain
  )
);
```

## Future Considerations

1. **Performance**: Monitor for any performance implications with many composed selectors
2. **Debugging**: Consider dev-mode tools to visualize composition
3. **Patterns Library**: Build a library of common composition patterns
4. **Framework Integration**: Ensure adapters handle composed slices efficiently

## Conclusion

The compose pattern aligns perfectly with Lattice's philosophy:
- **Simple primitives**: Everything is still a slice
- **Composable**: Build complex behavior from simple parts
- **Type-safe**: Full TypeScript support
- **Non-breaking**: Additive feature, no changes to existing code

This approach provides the flexibility users need while maintaining the simplicity that makes Lattice powerful.