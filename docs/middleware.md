# Middleware in Lattice

## Overview

Lattice provides two complementary middleware systems that operate at different stages of the component lifecycle:

1. **Composition Middleware** - Pure functions that transform selectors at composition time
2. **Slice Middleware** - Runtime services provided through the `api` parameter

Together, these systems provide complete control over how components are structured and how they behave at runtime.

## The Two Middleware Systems

### Composition Middleware (Build Time)

Operates on selector functions during component definition:

```typescript
// Transforms the selector function itself
const enhancedSelector = withDefaults({ disabled: false })(
  (model) => ({
    label: model.buttonText,
    onClick: model.handleClick
  })
);

const slice = createSlice(model, enhancedSelector);
```

**Characteristics:**
- Pure functions
- No side effects
- Transforms selector structure
- Operates at composition time
- Framework-agnostic

### Slice Middleware (Runtime)

Provides services through the `api` parameter during execution:

```typescript
const slice = createSlice(model, (m, api) => ({
  onClick: () => {
    api.log?.('Button clicked');        // Logging middleware
    api.trackEvent?.('button.click');   // Analytics middleware
    m.handleClick();
  }
}));
```

**Characteristics:**
- Runtime services
- Can have side effects
- Provides capabilities
- Operates during execution
- Adapter-specific

## How They Work Together

The beauty of Lattice's design is that both middleware systems work together seamlessly:

```typescript
const slice = createSlice(
  model,
  // Composition middleware wraps the selector
  withDefaults({ className: 'btn' })(
    memoized(
      compose(
        { actions, userData },
        // Slice middleware is available via api parameter
        (model, { actions, userData }, api) => {
          // Use runtime services
          api.log?.('Creating button slice');
          
          return {
            label: userData.name,
            onClick: () => {
              // Runtime middleware in action handlers
              api.trackEvent?.('button.click', { user: userData.id });
              actions.performAction();
            }
          };
        }
      )
    )
  )
);
```

## When to Use Which

### Use Composition Middleware When:

- **Transforming structure** - Adding defaults, modifying shape
- **Optimizing** - Memoization, caching selector results
- **Conditional logic** - Selecting different slices based on conditions
- **Reusing patterns** - Common selector transformations

Examples:
```typescript
withDefaults({ ... })        // Add default values
memoized(selector)           // Cache results
selectIf(condition, fallback) // Conditional selection
mapResult(transform)         // Transform output shape
```

### Use Slice Middleware When:

- **Logging/Debugging** - Track what's happening at runtime
- **Analytics** - Send events to tracking services
- **Performance monitoring** - Measure execution time
- **External integrations** - API calls, database access
- **Cross-cutting concerns** - Authentication, error handling

Examples:
```typescript
api.log('action', data)           // Logging
api.trackEvent('click', props)    // Analytics
api.measureTime('operation')      // Performance
api.authorize(action)             // Security
```

## Complete Example

Here's a real-world example using both middleware types:

```typescript
// Define composition middleware
function withLoadingState<T extends { onClick: () => void }>(
  loadingKey: string
) {
  return (selector: Selector<T>): Selector<T & { loading: boolean }> => {
    return (model, api) => {
      const result = selector(model, api);
      return {
        ...result,
        loading: model[loadingKey] || false,
        onClick: async () => {
          model.setLoading(loadingKey, true);
          try {
            await result.onClick();
          } finally {
            model.setLoading(loadingKey, false);
          }
        }
      };
    };
  };
}

// Define a component using both middleware types
const component = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    user: null,
    loadingStates: {},
    
    setLoading: (key: string, value: boolean) => {
      set({
        loadingStates: {
          ...get().loadingStates,
          [key]: value
        }
      });
    },
    
    fetchUser: async (id: string) => {
      const response = await fetch(`/api/users/${id}`);
      const user = await response.json();
      set({ user });
    }
  }));

  const actions = createSlice(model, (m, api) => ({
    fetchUser: async (id: string) => {
      // Slice middleware for monitoring
      const timer = api.startTimer?.('fetchUser');
      
      try {
        await m.fetchUser(id);
        api.log?.('User fetched successfully', { id });
      } catch (error) {
        api.logError?.('Failed to fetch user', { id, error });
        throw error;
      } finally {
        timer?.end();
      }
    }
  }));

  return {
    model,
    actions,
    views: {
      userButton: createSlice(
        model,
        // Stack composition middleware
        withLoadingState('fetchUser')(
          withDefaults({ 
            className: 'user-button',
            'aria-label': 'Fetch user data'
          })(
            compose(
              { actions },
              (m, { actions }, api) => ({
                onClick: () => actions.fetchUser('123'),
                label: m.user ? `Hello, ${m.user.name}` : 'Load User',
                disabled: m.loadingStates.fetchUser
              })
            )
          )
        )
      )
    }
  };
});
```

## Middleware Composition Patterns

### Stacking Composition Middleware

```typescript
// Manual stacking
const enhanced = middleware1(
  middleware2(
    middleware3(selector)
  )
);

// Using a utility
function pipe(...middlewares) {
  return (selector) => 
    middlewares.reduceRight((acc, mw) => mw(acc), selector);
}

const enhanced = pipe(
  withDefaults(defaults),
  withValidation(validate),
  memoized
)(selector);
```

### Enhancing Slice Middleware

```typescript
// Adapter can compose multiple middleware
function createEnhancedAdapter(component) {
  const baseApi = {
    executeSlice,
    getState
  };
  
  // Layer middleware
  const api = withLogging(
    withMetrics(
      withCache(baseApi)
    )
  );
  
  return createAdapter(component, api);
}
```

## Creating Custom Middleware

### Composition Middleware Template

```typescript
function myCompositionMiddleware<T>(options: Options) {
  return (selector: Selector<T>): Selector<Enhanced<T>> => {
    // Return a new selector function
    return (model, api) => {
      // Get the original result
      const result = selector(model, api);
      
      // Transform and return
      return enhance(result, options);
    };
  };
}
```

### Slice Middleware Template

```typescript
function mySliceMiddleware<Model>(api: AdapterAPI<Model>): EnhancedAPI<Model> {
  return {
    ...api,
    
    // Add new capabilities
    myFeature: (params) => {
      // Implementation
      return api.doSomething(params);
    }
  };
}
```

## Best Practices

### 1. Choose the Right Tool

- **Structure/Shape** → Composition Middleware
- **Runtime Behavior** → Slice Middleware

### 2. Keep Concerns Separated

```typescript
// ✅ GOOD: Each middleware has a single responsibility
const slice = pipe(
  withDefaults({ disabled: false }),    // Structure
  withValidation(isValid, fallback),   // Validation
  memoized                             // Performance
)(selector);

// ❌ BAD: Mixing concerns in one middleware
const slice = withEverything(selector); // Does too much
```

### 3. Maintain Type Safety

Both middleware types should preserve or properly transform types:

```typescript
// Composition middleware with proper types
function withExtra<T, E>(extra: E) {
  return (selector: Selector<T>): Selector<T & E> => {
    return (model, api) => ({
      ...selector(model, api),
      ...extra
    });
  };
}

// Slice middleware with proper types
interface MetricsAPI<Model> extends AdapterAPI<Model> {
  recordMetric: (name: string, value: number) => void;
}
```

### 4. Document Middleware Behavior

Always document what your middleware does and when to use it:

```typescript
/**
 * Adds automatic retry logic to async operations
 * 
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @param backoff - Backoff multiplier (default: 2)
 * 
 * @example
 * const action = withRetry(3, 2)(
 *   async () => api.fetchData()
 * )
 */
```

## Advanced Patterns

### Conditional Middleware Application

```typescript
const slice = createSlice(
  model,
  process.env.NODE_ENV === 'development'
    ? withLogging(selector)  // Only in dev
    : selector
);
```

### Middleware Factories

```typescript
function createCacheMiddleware(ttl: number) {
  const cache = new Map();
  
  return (selector) => (model, api) => {
    const key = JSON.stringify(model);
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.time < ttl) {
      return cached.value;
    }
    
    const value = selector(model, api);
    cache.set(key, { value, time: Date.now() });
    return value;
  };
}

// Use with different TTLs
const shortCache = createCacheMiddleware(1000);   // 1 second
const longCache = createCacheMiddleware(60000);   // 1 minute
```

## Summary

Lattice's dual middleware system provides:

1. **Composition Middleware** - Shape how components are structured
2. **Slice Middleware** - Add runtime capabilities

Together they offer:
- **Complete control** over both structure and behavior
- **Clean separation** of build-time vs runtime concerns
- **Natural composition** without framework magic
- **Type safety** throughout the stack

This design maintains Lattice's core principle of separating specification from execution while providing powerful extension points for advanced use cases.