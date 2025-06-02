# Compose Design

## Overview

The `compose()` function provides dependency injection for slices while maintaining the composition/execution boundary. It returns a multi-behavior function that encodes both dependencies and selector logic without executing anything during composition.

## API Design

```typescript
const composeSpec = compose(
  { actions, userSlice },  // Dependencies
  (m, { actions, userSlice }) => ({  // Selector
    onClick: actions.increment,
    userName: userSlice.name
  })
);
```

## Multi-Behavior Function

The returned `composeSpec` has two behaviors based on arguments:

1. **No arguments** - Returns the dependencies object
   ```typescript
   composeSpec()  // Returns: { actions, userSlice }
   ```

2. **With model** - Returns a partially applied function expecting resolved dependencies
   ```typescript
   const partiallyApplied = composeSpec(model);
   // partiallyApplied is: (resolvedDeps) => Result
   ```

## How Adapters Use It

```typescript
// In adapter's executeSliceFactory:
if (isComposeSpecFactory(selector)) {
  // Step 1: Extract dependencies (no execution)
  const deps = selector();  // { actions, userSlice }
  
  // Step 2: Adapter executes each dependency
  const resolved = {};
  for (const [key, factory] of Object.entries(deps)) {
    resolved[key] = executeSliceFactory(factory);  // Adapter executes!
  }
  
  // Step 3: Get partially applied function with model
  const partiallyApplied = selector(model);
  
  // Step 4: Call with resolved dependencies
  return partiallyApplied(resolved);
}
```

## Why This Design?

1. **Purely Functional**: No mutations, no side effects, just data transformation
2. **Clear Boundary**: Composition creates specs, adapters execute
3. **Type Safe**: TypeScript can track dependencies and their types
4. **Simple**: Just two calling patterns, no complex symbols

## Implementation

The compose function should:
1. Create a branded function with `COMPOSE_SPEC_MARKER`
2. Return dependencies when called with no args
3. Return a partially applied selector when called with model
4. Never execute any slice factories itself

## What NOT to Do

```typescript
// ❌ BAD: Executes dependencies during composition
return (model) => {
  const resolved = {};
  for (const [key, factory] of Object.entries(deps)) {
    resolved[key] = factory(model);  // Violates boundary!
  }
  return selector(model, resolved);
};

// ✅ GOOD: Returns a spec that adapters can execute
return Object.assign(
  function(arg?: Model) {
    if (arg === undefined) return deps;
    return (resolvedDeps: ResolvedDeps) => selector(arg, resolvedDeps);
  },
  { [COMPOSE_SPEC_MARKER]: true }
);
```