# Runtime Architecture

## Overview

Lattice's runtime provides a minimal layer that enables adapters to execute component specifications while maintaining clean separation between universal behavior and adapter-specific features.

## Core Concepts

### The Three Layers

```
[Component Spec] → [Adapter + Runtime] → [Native Store + Middleware]
```

1. **Component Specification**: Pure, declarative behavior definitions
2. **Adapter Layer**: Transforms components for specific state managers
3. **Native Store**: The actual state management solution (Zustand, Redux, etc.)

## The Runtime Pattern

The runtime's role is simple: provide a `createApi` function that adapters use to create their execution API.

### Basic Structure

```typescript
function createZustandAdapter<Model, Actions, Views>(
  component: ComponentSpec<Model, Actions, Views>,
  middleware?: (createStore: typeof zustandCreateStore, stateCreator: StateCreator) => StoreApi
) {
  return createRuntime((createApi) => {
    // 1. Transform component to native format (stateCreator for Zustand)
    const stateCreator = transformComponentToZustand(component);
    
    // 2. Let user apply native middleware
    const store = middleware 
      ? middleware(zustandCreateStore, stateCreator)
      : zustandCreateStore(stateCreator);
    
    // 3. Create API for executing slices
    const api = createApi({
      executeSlice: (slice) => slice(store.getState(), api),
      getState: () => store.getState(),
      // Adapter-specific extensions
      subscribe: store.subscribe
    });
    
    // 4. Execute component with API and return result
    return executeComponent(component, api, store);
  });
}
```

## User API

The user API feels exactly like using the native state manager:

### Zustand
```typescript
// Just like native Zustand
const store = createZustandAdapter(
  component,
  (createStore, stateCreator) => createStore(
    devtools(
      persist(stateCreator, { name: 'app-storage' })
    )
  )
);
```

### Redux
```typescript
// Just like native Redux
const store = createReduxAdapter(
  component,
  (createStore, reducer) => createStore(
    reducer,
    applyMiddleware(logger, thunk)
  )
);
```

### MobX (hypothetical)
```typescript
// Just like native MobX
const store = createMobXAdapter(
  component,
  (makeAutoObservable, model) => makeAutoObservable(model)
);
```

## The API Object

Every adapter creates an API object that slices receive:

```typescript
interface AdapterAPI<Model> {
  // Core methods (required)
  executeSlice<T>(slice: SliceFactory<Model, T>): T;
  getState(): Model;
  
  // Adapter-specific extensions
  // Zustand might add: subscribe
  // Redux might add: dispatch
  // etc.
}
```

### Self-Referential APIs

The API can reference itself, enabling slices to call other slices:

```typescript
const api = createApi({
  executeSlice: (slice) => slice(store.getState(), api), // api references itself
  getState: () => store.getState()
});
```

## Middleware Types

### 1. Native Middleware (State Manager Specific)

Applied through the adapter's callback:

```typescript
// Zustand middleware
createZustandAdapter(component, (create, stateCreator) => 
  create(devtools(persist(stateCreator)))
);

// Redux middleware  
createReduxAdapter(component, (createStore, reducer) => 
  createStore(reducer, applyMiddleware(logger))
);
```

### 2. Lattice Slice Middleware

Already implemented - slices receive the API parameter:

```typescript
const actions = createSlice(model, (m, api) => ({
  logAndIncrement: () => {
    console.log('Current:', api.getState());
    m.increment();
  }
}));
```

### 3. Lattice Composition Middleware

Already implemented - pure transformations at build time:

```typescript
const enhanced = compose(
  { userSlice, settingsSlice },
  (model, { userSlice, settingsSlice }) => ({
    userName: userSlice.name,
    theme: settingsSlice.theme
  })
);
```

## Adapter Implementation Guide

### Step 1: Accept Component and Native Middleware

```typescript
export function createMyAdapter<Model, Actions, Views>(
  component: ComponentSpec<Model, Actions, Views>,
  middleware?: (createStore: CreateStoreFn, payload: Payload) => Store
) {
```

### Step 2: Use Runtime to Create API

```typescript
  return createRuntime((createApi) => {
    // Your adapter implementation
  });
```

### Step 3: Transform Component to Native Format

```typescript
    // Example for Redux-like adapter
    const reducer = (state, action) => {
      // Transform component.model to reducer logic
    };
    
    // Example for MobX-like adapter  
    const observableModel = {
      // Transform component.model to observable
    };
```

### Step 4: Apply Native Middleware

```typescript
    const store = middleware
      ? middleware(nativeCreateStore, transformedPayload)
      : nativeCreateStore(transformedPayload);
```

### Step 5: Create API with Implementations

```typescript
    const api = createApi({
      executeSlice: (slice) => slice(getCurrentState(), api),
      getState: () => getCurrentState(),
      // Add adapter-specific methods
      customMethod: () => { /* ... */ }
    });
```

### Step 6: Execute Component and Return Result

```typescript
    const actions = component.actions(model, api);
    const views = processViews(component.views, api);
    
    return {
      actions,
      views,
      // Adapter-specific additions
      subscribe: store.subscribe
    };
  });
}
```

## Key Principles

### 1. Native Feel
Users should feel like they're using their familiar state manager, just with Lattice components instead of manual definitions.

### 2. Clean Separation
- Components know nothing about adapters
- Adapters handle all transformation
- Runtime just provides the API creation mechanism

### 3. No Magic
- No hidden middleware layers
- No complex type transformations
- Direct, simple execution flow

### 4. Extensibility
Adapters can add their own methods to the API, enabling adapter-specific features while maintaining portability.

## Common Patterns

### Error Handling

```typescript
const api = createApi({
  executeSlice: (slice) => {
    try {
      return slice(store.getState(), api);
    } catch (error) {
      console.error('Slice execution failed:', error);
      throw error;
    }
  },
  getState: () => store.getState()
});
```

### Performance Optimization

```typescript
// Cache slice results if needed
const cache = new WeakMap();
const api = createApi({
  executeSlice: (slice) => {
    if (cache.has(slice)) {
      return cache.get(slice);
    }
    const result = slice(store.getState(), api);
    cache.set(slice, result);
    return result;
  },
  getState: () => store.getState()
});
```

### Development Tools

```typescript
// Add dev-only methods
const api = createApi({
  executeSlice: (slice) => slice(store.getState(), api),
  getState: () => store.getState(),
  ...(process.env.NODE_ENV === 'development' && {
    _inspect: () => ({ store, component })
  })
});
```

## Summary

The runtime architecture is intentionally minimal:

1. **Runtime provides**: `createApi` function
2. **Adapters provide**: Implementation details
3. **Users provide**: Native middleware preferences
4. **Components remain**: Pure and portable

This design ensures maximum flexibility while maintaining a clean, understandable architecture.