# Computed Views Specification

## Overview

Computed views enable dynamic, parameterized view creation in Lattice while maintaining the framework's compositional purity. They provide a way to create views that accept runtime parameters without mixing runtime logic into static specifications.

## Motivation

Static views work well for fixed UI structures:

```typescript
views: {
  header: headerSlice,  // Always returns the same shape
  footer: footerSlice   // No parameters needed
}
```

However, many UIs require parameterized views:
- Tree nodes with dynamic IDs
- List items that need item-specific data
- Reusable components with different configurations
- Any view that needs runtime parameters

## Design

Computed views are functions that receive parameters and an adapter API, similar to how Zustand passes its API to store functions.

### Type Definition

```typescript
// All slice factories receive model and api
type SliceFactory<Model, Slice> = (model: Model, api: AdapterAPI<Model>) => Slice;

interface AdapterAPI<Model> {
  // Execute a slice and get its current value
  executeSlice: <T>(sliceFactory: SliceFactory<Model, T>) => T;
  
  // Note: getState() has been removed - use the model parameter instead
  // Optional extensions that adapters might provide (not part of core API)
  log?: (message: string, data?: any) => void;
  metrics?: {
    recordTiming: (name: string, duration: number) => void;
  };
  analytics?: {
    track: (event: string, properties?: any) => void;
  };
}
```

### Component Definition

```typescript
const component = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    nodes: [],
    expandedNodes: [],
    toggleNode: (id: string) => {
      const expanded = get().expandedNodes;
      set({
        expandedNodes: expanded.includes(id)
          ? expanded.filter(e => e !== id)
          : [...expanded, id]
      });
    }
  }));
  
  const nodeSlice = createSlice(model, (m, api) => ({
    nodes: m.nodes,
    expandedNodes: m.expandedNodes
  }));
  
  // Actions with api (for advanced use cases)
  const actions = createSlice(model, (m, api) => ({
    toggleNode: (id: string) => {
      api.log?.('toggleNode', { id, expanded: m.expandedNodes.includes(id) });
      m.toggleNode(id);
    },
    
    // Most actions won't need api
    addNode: (node: Node) => {
      m.addNode(node);
    }
  }));
  
  return {
    model,
    actions,
    views: {
      // Static view (api available but not used)
      header: createSlice(model, (m, api) => ({
        title: m.title,
        nodeCount: m.nodes.length
      })),
      
      // Computed view with parameters
      getNode: (nodeId: string, api) => {
        const state = api.executeSlice(nodeSlice);
        const node = state.nodes.find(n => n.id === nodeId);
        
        return {
          label: node?.label || 'Unknown',
          'aria-expanded': state.expandedNodes.includes(nodeId),
          className: node?.type || 'default'
        };
      },
      
      // Computed view with multiple parameters
      getFilteredList: (filter: string, sortBy: 'name' | 'date', api) => {
        const items = api.executeSlice(itemsSlice);
        
        const filtered = items.filter(item => 
          item.name.includes(filter)
        );
        
        const sorted = [...filtered].sort((a, b) => 
          sortBy === 'name' 
            ? a.name.localeCompare(b.name)
            : a.date - b.date
        );
        
        return { items: sorted, count: sorted.length };
      }
    }
  };
});
```

## Adapter Implementation

Adapters must detect computed views and inject the API:

```typescript
// In adapter implementation
const api: AdapterAPI<Model> = {
  executeSlice: (sliceFactory) => executeSliceFactory(sliceFactory)
};

// Process views
for (const [key, view] of Object.entries(spec.views)) {
  if (isSliceFactory(view)) {
    // Static view
    views[key] = () => executeSliceFactory(view);
  } else if (typeof view === 'function') {
    // Computed view - wrap to inject API
    views[key] = (...args) => {
      // Call with user args + api as last argument
      return view(...args, api);
    };
  }
}
```

### Memoization

Adapters should memoize computed views for performance:

```typescript
if (typeof view === 'function') {
  // Memoize based on arguments (excluding api)
  const memoized = memoize(view, {
    // Custom equality for args (ignore api in comparison)
    equalityCheck: (a, b) => {
      // Compare all args except the last one (api)
      return a.slice(0, -1).every((arg, i) => arg === b[i]);
    }
  });
  
  views[key] = (...args) => memoized(...args, api);
}
```

## Usage

### React

```typescript
function TreeView() {
  const store = useZustandAdapter();
  const { getNode } = store.views;
  
  return (
    <div>
      {nodeIds.map(id => (
        <TreeNode key={id} {...getNode(id)} />
      ))}
    </div>
  );
}
```

### With Hooks

```typescript
// For better React integration
function TreeNode({ nodeId }) {
  const getNode = useView(store, 'getNode');
  const nodeProps = getNode(nodeId);
  
  return <div {...nodeProps} />;
}
```

## Type Safety

The view types must handle both static and computed views:

```typescript
type ViewTypes<Model, Views> = {
  [K in keyof Views]: Views[K] extends SliceFactory<Model, infer T>
    ? () => T  // Static view
    : Views[K] extends (...args: infer Args) => infer R
      ? Args extends [...infer UserArgs, AdapterAPI<Model>]
        ? (...args: UserArgs) => R  // Computed view (without api in public signature)
        : never
      : never;
};
```

## Best Practices

### 1. Use Static Views When Possible

Static views are simpler and more efficient:

```typescript
// Prefer static views for fixed structures
views: {
  header: headerSlice,
  sidebar: sidebarSlice
}
```

### 2. Keep Computed Views Pure

Computed views should only compute based on their inputs:

```typescript
// ✅ Good: Pure computation
getNode: (nodeId, api) => {
  const state = api.executeSlice(nodeSlice);
  return {
    label: state.nodes[nodeId]?.label
  };
}

// ❌ Bad: Side effects
getNode: (nodeId, api) => {
  console.log('Getting node', nodeId);  // Side effect!
  localStorage.setItem('lastNode', nodeId);  // Side effect!
  return { /* ... */ };
}
```

### 3. Minimize Slice Executions

Execute slices once and reuse the data:

```typescript
// ✅ Good: Single execution
getNodeSummary: (nodeId, api) => {
  const state = api.executeSlice(treeSlice);
  const node = state.nodes[nodeId];
  const children = state.nodes.filter(n => n.parentId === nodeId);
  
  return {
    label: node?.label,
    childCount: children.length,
    isExpanded: state.expanded.includes(nodeId)
  };
}

// ❌ Bad: Multiple executions
getNodeSummary: (nodeId, api) => {
  const nodes = api.executeSlice(nodesSlice);
  const expanded = api.executeSlice(expandedSlice);  // Unnecessary!
  // ...
}
```

### 4. Consider Memoization Costs

For frequently changing parameters, memoization overhead might not be worth it:

```typescript
views: {
  // High-frequency updates (e.g., mouse position) might not benefit from memoization
  getCursorInfo: (x: number, y: number, api) => ({
    position: `${x}, ${y}`,
    quadrant: x > 500 ? (y > 500 ? 'SE' : 'NE') : (y > 500 ? 'SW' : 'NW')
  })
}
```

## Migration Guide

To convert existing parameterized view patterns:

### Before (Factory Pattern)
```typescript
// Old: Pre-instantiate all possible views
const createNodeView = (nodeId: string) => 
  createSlice(model, (m) => ({
    label: m.nodes.find(n => n.id === nodeId)?.label
  }));

views: {
  node1: createNodeView('1'),
  node2: createNodeView('2'),
  // ... must know all IDs at composition time
}
```

### After (Computed Views)
```typescript
// New: Dynamic parameterization
views: {
  getNode: (nodeId: string, api) => {
    const state = api.executeSlice(nodesSlice);
    return {
      label: state.nodes.find(n => n.id === nodeId)?.label
    };
  }
}

// Usage
store.views.getNode('dynamic-id');  // Works with any ID!
```

## Future Considerations

### Async Computed Views

For data fetching scenarios:

```typescript
getNodeWithDetails: async (nodeId: string, api) => {
  const node = api.executeSlice(nodeSlice);
  const details = await fetchNodeDetails(nodeId);
  
  return {
    ...node,
    ...details
  };
}
```

## Unified API: Actions and Views

Both actions and views receive the same API parameter for consistency, though their use cases differ.

### Actions with API Access

Actions receive the `api` parameter but should rarely need it:

```typescript
const actions = createSlice(model, (m, api) => ({
  // Normal action - doesn't need api
  increment: () => {
    m.increment();
  },
  
  // Advanced use case: Action with logging
  incrementWithLogging: () => {
    api.log?.('increment:start', { count: m.count });
    m.increment();
    api.log?.('increment:end', { count: m.count });
  },
  
  // Advanced use case: Performance monitoring
  complexOperation: async (data: any) => {
    const start = performance.now();
    
    // ... complex operation
    m.processData(data);
    
    api.metrics?.recordTiming('complexOperation', performance.now() - start);
  }
}));
```

### Best Practices for Actions

```typescript
// ✅ GOOD: Actions for mutations
const actions = createSlice(model, (m, api) => ({
  addTodo: (text: string) => {
    const todo = { id: Date.now(), text, completed: false };
    m.addTodo(todo);
    
    // OK: Using api for side effects
    api.analytics?.track('todo:added', { todoId: todo.id });
  }
}));

// ❌ BAD: Using api to read from other slices
const actions = createSlice(model, (m, api) => ({
  // Don't do this - restructure your model instead
  badAction: () => {
    const otherData = api.executeSlice(otherSlice); // ❌
    m.updateBasedOn(otherData);
  }
}));
```

### Computed Views with Parameters

Views use the `api` parameter for parameterized data access:

## Advanced Patterns: Middleware Composition

The `api` parameter opens the door for middleware composition. Adapters can enhance the API with additional capabilities:

### Example: Logging Middleware

```typescript
// Middleware that logs all slice executions
function withLogging<Model>(api: AdapterAPI<Model>): AdapterAPI<Model> {
  return {
    ...api,
    executeSlice: (sliceFactory) => {
      console.log('Executing slice:', sliceFactory.name || 'anonymous');
      const result = api.executeSlice(sliceFactory);
      console.log('Slice result:', result);
      return result;
    }
  };
}

// In adapter implementation
const baseApi: AdapterAPI<Model> = {
  executeSlice: (sliceFactory) => executeSliceFactory(sliceFactory)
};

// Apply middleware
const enhancedApi = withLogging(baseApi);
```

### Example: Performance Tracking

```typescript
interface PerformanceAPI<Model> extends AdapterAPI<Model> {
  measureSlice: <T>(
    name: string, 
    sliceFactory: SliceFactory<Model, T>
  ) => T;
}

function withPerformance<Model>(
  api: AdapterAPI<Model>
): PerformanceAPI<Model> {
  const timings = new Map<string, number[]>();
  
  return {
    ...api,
    measureSlice: (name, sliceFactory) => {
      const start = performance.now();
      const result = api.executeSlice(sliceFactory);
      const duration = performance.now() - start;
      
      if (!timings.has(name)) {
        timings.set(name, []);
      }
      timings.get(name)!.push(duration);
      
      // Log slow executions
      if (duration > 16) {
        console.warn(`Slow slice execution: ${name} took ${duration}ms`);
      }
      
      return result;
    }
  };
}

// Usage in computed view
views: {
  getExpensiveView: (params: string, api: PerformanceAPI<Model>) => {
    const data = api.measureSlice('expensiveSlice', expensiveSlice);
    return {
      // ... compute view from data
    };
  }
}
```

### Example: Caching Middleware

```typescript
function withCache<Model>(
  api: AdapterAPI<Model>,
  ttl: number = 1000
): AdapterAPI<Model> {
  const cache = new Map<SliceFactory<any, any>, {
    value: any;
    timestamp: number;
  }>();
  
  return {
    ...api,
    executeSlice: (sliceFactory) => {
      const cached = cache.get(sliceFactory);
      const now = Date.now();
      
      if (cached && now - cached.timestamp < ttl) {
        return cached.value;
      }
      
      const value = api.executeSlice(sliceFactory);
      cache.set(sliceFactory, { value, timestamp: now });
      return value;
    }
  };
}
```

### Composing Multiple Middlewares

```typescript
// In adapter
const createEnhancedApi = <Model>(base: AdapterAPI<Model>) => {
  return withCache(
    withPerformance(
      withLogging(base)
    )
  );
};

// Or with a compose utility
const enhancedApi = compose(
  withCache,
  withPerformance,
  withLogging
)(baseApi);
```

### Custom API Extensions

Adapters can add domain-specific methods:

```typescript
interface ExtendedAPI<Model> extends AdapterAPI<Model> {
  // Get multiple slices at once
  executeSlices: <T extends Record<string, SliceFactory<Model, any>>>(
    slices: T
  ) => { [K in keyof T]: T[K] extends SliceFactory<Model, infer U> ? U : never };
  
  // Conditional execution
  executeSliceIf: <T>(
    condition: boolean,
    sliceFactory: SliceFactory<Model, T>,
    defaultValue: T
  ) => T;
}

// Usage in computed view
views: {
  getDashboard: (userId: string, api: ExtendedAPI<Model>) => {
    const { user, stats, settings } = api.executeSlices({
      user: userSlice,
      stats: statsSlice,
      settings: settingsSlice
    });
    
    const adminData = api.executeSliceIf(
      user.role === 'admin',
      adminSlice,
      null
    );
    
    return {
      userName: user.name,
      totalStats: stats.total,
      theme: settings.theme,
      adminPanel: adminData
    };
  }
}
```

## API Consistency Benefits

Having all slices receive `(model, api)` provides several advantages:

### For Framework Users
- **One pattern to learn**: Whether it's actions or views, the signature is consistent
- **Predictable behavior**: "If it uses createSlice, it gets model and api"
- **Progressive disclosure**: Basic usage ignores api, advanced usage leverages it

### For Adapter Authors
- **Simpler implementation**: One execution path for all slices
- **Uniform middleware**: The same middleware works for actions and views
- **Easier testing**: Consistent mocking patterns

### For Middleware Authors
- **Universal application**: Middleware can enhance both actions and views
- **Consistent hooks**: Same interception points throughout

```typescript
// One execution pattern for all slices
const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
  return factory(model, api);  // Always the same
};
```

## Summary

The unified API design provides:

- **Consistency**: All slices receive `(model, api)` parameters
- **Power**: Advanced use cases are possible when needed
- **Simplicity**: Basic usage can ignore the api parameter
- **Extensibility**: Middleware composition for both actions and views
- **Type-safety**: Full TypeScript support with proper inference
- **Familiarity**: Similar to Zustand's API pattern

Key principles:
- **Actions**: Use api for logging, metrics, and devtools - not for reading state
- **Views**: Use api for parameterized data access and cross-slice queries
- **Both**: Benefit from middleware enhancements

This design maintains Lattice's core principle of separating specification from execution while providing a consistent, powerful API for all use cases.