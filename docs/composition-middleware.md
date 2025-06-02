# Composition Middleware Specification

## Overview

Composition middleware in Lattice consists of pure functions that transform and enhance slice selectors at composition time. Unlike slice middleware (which operates at runtime via the `api` parameter), composition middleware operates on the selector functions themselves, allowing you to modify how slices are structured and composed.

## Core Concepts

### What is Composition Middleware?

Composition middleware are higher-order functions that:
1. Take a selector function as input
2. Return an enhanced selector function
3. Operate at composition time (not runtime)
4. Are pure functions with no side effects

```typescript
// Basic composition middleware pattern
function withSomeBehavior(selector: Selector): Selector {
  return (model, api) => {
    // Transform or enhance the selector's result
    const result = selector(model, api);
    return modifyResult(result);
  };
}
```

### The `compose` Function

The built-in `compose` function is the most common composition middleware:

```typescript
// compose is composition middleware that resolves dependencies
const selector = compose(
  { actions, userSlice },
  (model, { actions, userSlice }, api) => ({
    onClick: actions.increment,
    userName: userSlice.name
  })
);

// It returns a function that receives (model, api)
const slice = createSlice(model, selector);
```

## Creating Composition Middleware

### Basic Example: Default Values

```typescript
function withDefaults<T>(defaults: Partial<T>) {
  return (selector: Selector<T>): Selector<T> => {
    return (model, api) => ({
      ...defaults,
      ...selector(model, api)
    });
  };
}

// Usage
const buttonSlice = createSlice(
  model,
  withDefaults({ 
    className: 'btn-default', 
    disabled: false 
  })(
    (m) => ({
      onClick: m.handleClick,
      label: m.buttonText
    })
  )
);
```

### Advanced Example: Conditional Selection

```typescript
function selectIf<T>(condition: (model: any) => boolean, defaultValue: T) {
  return (selector: Selector<T>): Selector<T | typeof defaultValue> => {
    return (model, api) => {
      if (condition(model)) {
        return selector(model, api);
      }
      return defaultValue;
    };
  };
}

// Usage
const adminPanelSlice = createSlice(
  model,
  selectIf(
    (m) => m.user.role === 'admin',
    null
  )(
    compose(
      { adminData, adminActions },
      (m, { adminData, adminActions }) => ({
        stats: adminData.stats,
        onRefresh: adminActions.refresh
      })
    )
  )
);
```

### Memoization Middleware

```typescript
function memoized<T>(selector: Selector<T>): Selector<T> {
  let lastModel: any;
  let lastApi: any;
  let lastResult: T;
  
  return (model, api) => {
    if (model === lastModel && api === lastApi) {
      return lastResult;
    }
    
    lastModel = model;
    lastApi = api;
    lastResult = selector(model, api);
    return lastResult;
  };
}

// Usage
const expensiveSlice = createSlice(
  model,
  memoized(
    (m) => ({
      // Expensive computation
      sortedItems: [...m.items].sort((a, b) => b.priority - a.priority),
      stats: calculateComplexStats(m.items)
    })
  )
);
```

## Composing Multiple Middleware

Composition middleware can be combined using function composition:

```typescript
// Manual composition
const enhancedSelector = withDefaults(defaultProps)(
  memoized(
    withLogging(
      selector
    )
  )
);

// Or create a compose utility for middleware
function pipe(...middlewares) {
  return (selector) => 
    middlewares.reduceRight((acc, middleware) => middleware(acc), selector);
}

// Usage
const slice = createSlice(
  model,
  pipe(
    withDefaults({ className: 'default' }),
    memoized,
    withLogging
  )(
    compose(
      { actions },
      (m, { actions }) => ({
        onClick: actions.increment,
        count: m.count
      })
    )
  )
);
```

## Working with `compose`

The `compose` function is special because it provides dependency injection while maintaining compatibility with other composition middleware:

```typescript
// compose returns a selector that receives (model, api)
function enhancedCompose(deps, selector) {
  // Wrap the standard compose with additional behavior
  return withTiming('compose')(
    compose(deps, selector)
  );
}

// The selector inside compose receives the api parameter
const slice = createSlice(
  model,
  enhancedCompose(
    { actions, data },
    (model, { actions, data }, api) => {
      // api is available here!
      api.log?.('Creating slice with data:', data);
      
      return {
        onClick: () => {
          api.trackEvent?.('button.click');
          actions.increment();
        }
      };
    }
  )
);
```

## Best Practices

### 1. Keep Middleware Pure

Composition middleware should never have side effects:

```typescript
// ✅ GOOD: Pure transformation
function withUpperCase(selector) {
  return (model, api) => {
    const result = selector(model, api);
    return {
      ...result,
      label: result.label?.toUpperCase()
    };
  };
}

// ❌ BAD: Side effects
function badMiddleware(selector) {
  return (model, api) => {
    console.log('Executing selector'); // Side effect!
    localStorage.setItem('lastRun', Date.now()); // Side effect!
    return selector(model, api);
  };
}
```

### 2. Preserve Type Safety

Use TypeScript generics to maintain type information:

```typescript
function withNullCheck<T>(
  fallback: T
): (selector: Selector<T | null>) => Selector<T> {
  return (selector) => (model, api) => {
    const result = selector(model, api);
    return result ?? fallback;
  };
}
```

### 3. Document Middleware Behavior

```typescript
/**
 * Adds retry logic to slice selectors that might fail
 * @param maxRetries - Maximum number of retry attempts
 * @param delay - Delay between retries in ms
 */
function withRetry(maxRetries = 3, delay = 100) {
  return (selector) => (model, api) => {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return selector(model, api);
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          // In practice, you'd use a proper async pattern
          const start = Date.now();
          while (Date.now() - start < delay) { /* wait */ }
        }
      }
    }
    
    throw lastError;
  };
}
```

## Common Patterns

### Validation Middleware

```typescript
function withValidation<T>(validate: (result: T) => boolean, errorValue: T) {
  return (selector: Selector<T>): Selector<T> => {
    return (model, api) => {
      const result = selector(model, api);
      
      if (!validate(result)) {
        api.log?.('Validation failed for selector result:', result);
        return errorValue;
      }
      
      return result;
    };
  };
}

// Usage
const userSlice = createSlice(
  model,
  withValidation(
    (user) => user.id && user.name,
    { id: 0, name: 'Unknown', role: 'guest' }
  )(
    (m) => m.currentUser
  )
);
```

### Transform Middleware

```typescript
function mapResult<T, U>(transform: (result: T) => U) {
  return (selector: Selector<T>): Selector<U> => {
    return (model, api) => transform(selector(model, api));
  };
}

// Usage
const slice = createSlice(
  model,
  mapResult(({ items, ...rest }) => ({
    ...rest,
    itemCount: items.length,
    hasItems: items.length > 0
  }))(
    (m) => ({
      items: m.todos,
      filter: m.filter
    })
  )
);
```

## Integration with Slice Middleware

Composition middleware and slice middleware (via `api`) work together seamlessly:

```typescript
const slice = createSlice(
  model,
  // Composition middleware
  withDefaults({ loading: false })(
    memoized(
      compose(
        { userData, userActions },
        // This function receives api from the adapter
        (model, { userData, userActions }, api) => {
          // Use slice middleware features
          api.log?.('Composing user slice');
          
          return {
            name: userData.name,
            onUpdate: (name: string) => {
              // Slice middleware in action
              api.trackEvent?.('user.update', { name });
              userActions.updateName(name);
            }
          };
        }
      )
    )
  )
);
```

## Summary

Composition middleware provides a powerful way to:
- Transform selector results at composition time
- Add common patterns (defaults, validation, memoization)
- Compose behaviors without modifying the core selector logic
- Work seamlessly with slice middleware for complete control

Unlike slice middleware (which adds runtime capabilities), composition middleware shapes how slices are structured and composed, maintaining Lattice's principle of pure, composable specifications.