# Adapter Updates for API Middleware

## Overview

To support the unified middleware system where all slices receive `(model, api)` parameters, all adapters need to be updated. This document outlines the required changes and provides implementation guidance.

## Current vs Target State

### Current Implementation
```typescript
// Slices only receive model
const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
  const model = getModel();
  return factory(model);  // ❌ Missing api parameter
};
```

### Target Implementation
```typescript
// Slices receive both model and api
const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
  const model = getModel();
  return factory(model, api);  // ✅ Includes api parameter
};
```

## Core Type Updates

First, the core `SliceFactory` type needs updating:

```typescript
// In @lattice/core/index.ts
type SliceFactory<Model, Slice> = (
  model: Model, 
  api: AdapterAPI<Model>
) => Slice;

// Base API interface that all adapters must provide
interface AdapterAPI<Model> {
  // Core methods
  executeSlice: <T>(sliceFactory: SliceFactory<Model, T>) => T;
  getState: () => Model;
  
  // Optional extensions
  [key: string]: any;
}
```

## Adapter Implementation Pattern

Each adapter should follow this pattern:

```typescript
export function createAdapter<Model, Actions, Views>(
  component: ComponentSpec<Model, Actions, Views>
): AdapterResult<Model, Actions, Views> {
  // 1. Set up the store/state management
  const store = setupStore(component.model);
  
  // 2. Create recursive-safe executeSlice
  let api: AdapterAPI<Model>;
  
  const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
    const model = store.getState();
    return factory(model, api);
  };
  
  // 3. Create the API object
  api = {
    executeSlice: executeSliceFactory,
    getState: () => store.getState(),
    // Add adapter-specific methods here
  };
  
  // 4. Process actions with API
  const actions = executeSliceFactory(component.actions);
  
  // 5. Process views with API
  const views = processViews(component.views, api);
  
  // 6. Return adapter result
  return {
    actions,
    views,
    getState: api.getState,
    destroy: () => store.destroy?.()
  };
}
```

## Processing Views

Views need special handling for computed views:

```typescript
function processViews<Model, Views>(
  viewSpecs: Views,
  api: AdapterAPI<Model>
): ProcessedViews<Model, Views> {
  const views = {} as ProcessedViews<Model, Views>;
  
  for (const [key, view] of Object.entries(viewSpecs)) {
    if (isSliceFactory(view)) {
      // Static view - wrap in function
      views[key] = () => {
        const result = api.executeSlice(view);
        // Return shallow copy for fresh references
        return shallowCopy(result);
      };
    } else if (typeof view === 'function') {
      // Computed view - inject api as last parameter
      views[key] = (...args) => {
        return view(...args, api);
      };
    }
  }
  
  return views;
}
```

## Adapter-Specific APIs

Each adapter can extend the base API with adapter-specific functionality:

### Zustand Adapter
```typescript
interface ZustandAPI<Model> extends AdapterAPI<Model> {
  // Zustand-specific subscriptions
  subscribe: <T>(
    selector: (state: Model) => T,
    callback: (value: T) => void,
    options?: { equalityFn?: (a: T, b: T) => boolean }
  ) => () => void;
  
  // If temporal middleware is used
  temporal?: {
    undo: () => void;
    redo: () => void;
    clear: () => void;
  };
}

// In implementation
const api: ZustandAPI<Model> = {
  executeSlice: executeSliceFactory,
  getState: () => store.getState(),
  subscribe: store.subscribe,
  temporal: store.temporal
};
```

### Redux Adapter
```typescript
interface ReduxAPI<Model> extends AdapterAPI<Model> {
  // Redux-specific dispatch
  dispatch: (action: AnyAction) => void;
  
  // Redux DevTools integration
  devtools?: {
    send: (action: string, state: any) => void;
  };
}

// In implementation
const api: ReduxAPI<Model> = {
  executeSlice: executeSliceFactory,
  getState: () => store.getState(),
  dispatch: store.dispatch,
  devtools: window.__REDUX_DEVTOOLS_EXTENSION__?.send
};
```

### Memory Adapter
```typescript
interface MemoryAPI<Model> extends AdapterAPI<Model> {
  // Memory-specific utilities
  reset: () => void;
  snapshot: () => Model;
  restore: (snapshot: Model) => void;
}

// In implementation
const api: MemoryAPI<Model> = {
  executeSlice: executeSliceFactory,
  getState: () => modelStore.get(),
  reset: () => modelStore.set(initialModel),
  snapshot: () => ({ ...modelStore.get() }),
  restore: (snapshot) => modelStore.set(snapshot)
};
```

## Migration Checklist

For each adapter, update:

### 1. Create API Object
```typescript
const api: AdapterAPI<Model> = {
  executeSlice: executeSliceFactory,
  getState: () => store.getState()
};
```

### 2. Update executeSliceFactory
```typescript
const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
  const model = getCurrentModel();
  return factory(model, api);  // Add api parameter
};
```

### 3. Update Action Processing
```typescript
// Before
const actions = spec.actions(model);

// After
const actions = executeSliceFactory(spec.actions);
```

### 4. Update View Processing
```typescript
// Handle computed views
if (typeof view === 'function') {
  views[key] = (...args) => view(...args, api);
}
```

### 5. Update Tests
```typescript
// Test API for testing
const testApi: AdapterAPI<Model> = {
  executeSlice: (factory) => factory(model, testApi),
  getState: () => model,
  // Test-specific helpers
  _history: [],
  _logCall: (method, args) => testApi._history.push({ method, args })
};
```

## Middleware Support

Adapters can support middleware by wrapping the API:

```typescript
function createAdapterWithMiddleware(component, middlewares = []) {
  // Create base API
  let api = createBaseAPI();
  
  // Apply middleware
  for (const middleware of middlewares) {
    api = middleware(api);
  }
  
  // Use enhanced API in adapter
  return createAdapter(component, api);
}

// Usage
const adapter = createAdapterWithMiddleware(component, [
  withLogging,
  withMetrics,
  withCache({ ttl: 5000 })
]);
```

## Testing the Updates

Each adapter should have tests verifying:

```typescript
describe('API parameter support', () => {
  it('should pass api to slices', () => {
    let receivedApi;
    
    const component = createComponent(() => ({
      model: createModel(() => ({ value: 'test' })),
      actions: createSlice(model, (m, api) => {
        receivedApi = api;
        return { test: () => {} };
      }),
      views: {}
    }));
    
    const adapter = createAdapter(component);
    
    expect(receivedApi).toBeDefined();
    expect(receivedApi.executeSlice).toBeFunction();
    expect(receivedApi.getState).toBeFunction();
  });
  
  it('should pass api to computed views', () => {
    let receivedApi;
    
    const component = createComponent(() => ({
      model: createModel(() => ({ value: 'test' })),
      actions: createSlice(model, () => ({})),
      views: {
        computed: (param, api) => {
          receivedApi = api;
          return { param };
        }
      }
    }));
    
    const adapter = createAdapter(component);
    adapter.views.computed('test');
    
    expect(receivedApi).toBeDefined();
  });
});
```

## Backward Compatibility

If needed, adapters can support both old and new signatures during migration:

```typescript
const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
  const model = getModel();
  
  // Check if factory expects api parameter
  if (factory.length === 2) {
    return factory(model, api);
  } else {
    // Legacy support
    console.warn('SliceFactory without api parameter is deprecated');
    return (factory as any)(model);
  }
};
```

## Implementation Order

1. **Update Core Types** - Define `AdapterAPI` interface
2. **Update Test Utils** - Ensure test adapter provides API
3. **Update Memory Adapter** - Simplest implementation
4. **Update Zustand Adapter** - Add Zustand-specific methods
5. **Update Redux Adapter** - Add Redux-specific methods
6. **Update Examples** - Show API usage patterns
7. **Update Documentation** - Reflect new capabilities

## Summary

All adapters need to:
1. Create an API object with `executeSlice` and `getState`
2. Pass the API to all slice factory executions
3. Handle computed views by injecting API as last parameter
4. Optionally add adapter-specific methods
5. Support middleware enhancement of the API

This update enables the powerful middleware patterns described in the middleware documentation while maintaining backward compatibility and type safety.