# Signal Primitives Design Document

## Overview

Signal primitives extend Lattice's reactive system with specialized behaviors. The `mut` primitive enables direct mutations on arrays and objects while maintaining reactivity.

## Requirements

1. **Zero Runtime Overhead** - No performance impact on hot paths
2. **Minimal Bundle Size** - Under 350 bytes total (hybrid approach)
3. **Type Safety** - Full TypeScript inference
4. **Simple Integration** - Works with existing signal architecture

## Core Architecture

### Primitive Protocol

```typescript
// Primitives return markers or factories
type MiddlewareResult<T> = T | SignalFactory<T>;

interface SignalFactory<T> {
  __factory: true;
  create(scope: any): InternalSignal<T>;
  value: T;
}

// Primitive function signature
type Primitive<T> = (value: T) => PrimitiveMarker<T> | SignalFactory<T>;
```

### Signal Creation Enhancement

The signal creation in `lattice-integration.ts` will be updated to detect and handle factories:

```typescript
function signal<T>(value: T | SignalFactory<T>): LatticeSignal<T> {
  let signalInstance: InternalSignal<T>;
  
  // Detect and handle factory
  if (isFactory(value)) {
    signalInstance = value.create(scope);
  } else {
    signalInstance = createSignal(value);
  }
  
  // Add subscribe method (maintains stable shape)
  signalInstance.subscribe = (listener: () => void) =>
    subscribe(signalInstance, listener);
    
  return signalInstance as LatticeSignal<T>;
}

function isFactory<T>(value: T | SignalFactory<T>): value is SignalFactory<T> {
  return value && typeof value === 'object' && '__factory' in value;
}
```

### Prototype Enhancement Pattern

Middlewares enhance signals by creating specialized prototypes:

```typescript
// Base signal prototype
const SignalPrototype = Signal.prototype;

// Enhanced prototype for middleware
function createEnhancedPrototype(baseProto: object, overrides: object): object {
  const proto = Object.create(baseProto);
  Object.assign(proto, overrides);
  return proto;
}
```

## Implementation Details

### Factory Composition

```typescript
// Composable factory pattern
class MiddlewareFactory<T> implements SignalFactory<T> {
  __factory = true as const;
  
  constructor(
    public value: T,
    private enhance: (signal: InternalSignal<T>, scope: any) => void
  ) {}
  
  create(scope: any): InternalSignal<T> {
    // Use the scoped signal factory from the scope
    const { signal: createSignal } = createScopedSignalFactory();
    const signal = createSignal(this.value);
    this.enhance(signal, scope);
    return signal;
  }
}
```

### Primitive Registration

```typescript
// Registry for primitive handlers
const primitiveHandlers = new Map<string, PrimitiveHandler>();

interface PrimitiveHandler {
  create(value: any): InternalSignal<any>;
}

// Register mut primitive
primitiveHandlers.set('mut', {
  create(value) {
    const signal = createSignal(value);
    
    if (Array.isArray(value)) {
      Object.setPrototypeOf(signal, MutArrayPrototype);
    } else if (isObject(value)) {
      Object.setPrototypeOf(signal, MutObjectPrototype);
      signal._value = createMutProxy(value, signal);
    }
    
    return signal;
  }
});
```

## Mut Middleware Implementation

### Design Goals

The `mut` middleware enables shallow mutations on arrays and tracked object properties without triggering top-level listeners unnecessarily. Uses a hybrid approach:
- **Arrays**: Direct method patching (no proxy)
- **Objects**: Property definition with setters for known properties
- **Maps/Sets**: Direct method patching (future enhancement)

### Implementation Strategy

```typescript
// Mut middleware implementation
function mut<T>(value: T): SignalFactory<T> {
  return new MiddlewareFactory(value, (signal) => {
    // Create specialized prototype based on value type
    if (Array.isArray(value)) {
      Object.setPrototypeOf(signal, MutArrayPrototype);
      signal._value = enhanceMutArray(value, () => {
        signal._version++;
        globalVersion++;
        notifyTargets(signal);
      });
    } else if (isPlainObject(value)) {
      Object.setPrototypeOf(signal, MutObjectPrototype);
      signal._value = enhanceMutObject(value, () => {
        signal._version++;
        globalVersion++;
        notifyTargets(signal);
      });
    }
    
    // Keep original setter for reference changes
    const originalSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(signal), 
      'value'
    ).set;
    
    // Override setter to re-enhance on reference change
    Object.defineProperty(signal, 'value', {
      get() { return this._value; },
      set(newValue) {
        if (Array.isArray(newValue)) {
          newValue = enhanceMutArray(newValue, () => {
            this._version++;
            globalVersion++;
            notifyTargets(this);
          });
        } else if (isPlainObject(newValue)) {
          newValue = enhanceMutObject(newValue, () => {
            this._version++;
            globalVersion++;
            notifyTargets(this);
          });
        }
        originalSetter.call(this, newValue);
      }
    });
  });
}
```

### Hybrid Implementation

```typescript
// Array enhancement - direct method patching
function enhanceMutArray<T extends any[]>(
  arr: T,
  notify: () => void
): T {
  const mutatingMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
  
  mutatingMethods.forEach(method => {
    const original = arr[method];
    arr[method] = function(...args: any[]) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
  });
  
  // Also patch index assignments via custom setter
  return new Proxy(arr, {
    set(target, prop, value) {
      const result = Reflect.set(target, prop, value);
      if (!isNaN(Number(prop))) notify(); // Numeric indices only
      return result;
    }
  });
}

// Object enhancement - property definitions
function enhanceMutObject<T extends object>(
  obj: T,
  notify: () => void
): T {
  const enhanced = {} as T;
  
  // Define getters/setters for existing properties
  Object.keys(obj).forEach(key => {
    let value = obj[key];
    Object.defineProperty(enhanced, key, {
      get() { return value; },
      set(newValue) {
        if (value !== newValue) {
          value = newValue;
          notify();
        }
      },
      enumerable: true,
      configurable: true
    });
  });
  
  // Note: Dynamic properties won't be tracked
  // Document this limitation clearly
  return enhanced;
}
```

### Implementation Notes

1. **Array Tracking**: Uses minimal proxy only for index assignments, methods are directly patched
2. **Object Tracking**: No proxy needed - uses Object.defineProperty for known properties
3. **Dynamic Properties**: Not supported for objects (documented limitation)
4. **Performance**: Faster than full proxy approach, especially for objects

## Performance Considerations

### Bundle Size Impact

```typescript
Core: ~100 bytes gzipped
Mut primitive: ~200 bytes gzipped (hybrid approach)
Total: ~300 bytes gzipped
```

### Runtime Performance

1. **Declaration Time**: ~200ns per middleware application
2. **Hot Path**: Zero overhead (direct property access maintained)
3. **Mutation Overhead**: 
   - Arrays: ~20ns per method call (direct patch)
   - Objects: ~10ns per property set (defineProperty)
4. **Memory**: One prototype object per middleware type + enhanced value objects

### Optimization Strategies

1. **Prototype Caching**
   ```typescript
   const prototypeCache = new Map<string, object>();
   ```

2. **Monomorphic Shapes**
   - All signals maintain same property structure
   - Prototypes pre-created and cached
   - No hidden class transitions

3. **Fast Type Checks**
   ```typescript
   const isObject = (v: unknown): v is object => 
     v !== null && (typeof v === 'object' || typeof v === 'function');
   ```

## Type Safety

### Type Inference

```typescript
// Primitive preserves type
declare function mut<T>(value: T): SignalFactory<T>;

// Full inference works
const todos = signal(mut([])); // Signal<Array<any>>
const state = signal(mut({ count: 0 })); // Signal<{ count: number }>
```

### Branded Types

```typescript
// Optional: Brand enhanced signals
interface MutSignal<T> extends Signal<T> {
  __mut: true;
}

// Middleware can return branded types
function mut<T>(value: T): SignalFactory<T> & { 
  __brand: 'mut' 
};
```

## Migration Path

### Phase 1: Core Implementation (1 day)
1. Update `signal()` to detect factories
2. Implement factory protocol
3. Add prototype enhancement utilities
4. Ensure zero performance regression

### Phase 2: Mut Middleware (2 days)
1. Implement basic mut functionality
2. Add proxy caching and optimization
3. Handle all collection types (Array, Map, Set)
4. Comprehensive testing

### Phase 3: Validation (1 day)
1. Performance benchmarks
2. Bundle size analysis
3. Type inference testing
4. Integration with existing middleware

## Testing Strategy

### Performance Tests

```typescript
// Benchmark: Middleware overhead
benchmark('middleware creation overhead', () => {
  const base = signal(0);
  const enhanced = signal(mut(0));
  // Should be < 500ns difference
});

// Benchmark: Hot path performance
benchmark('getter performance', () => {
  const enhanced = signal(mut({ count: 0 }));
  // Should match base signal performance
  for (let i = 0; i < 1000000; i++) {
    enhanced.value.count;
  }
});
```

### Functional Tests

```typescript
test('mut prevents unnecessary updates', () => {
  const arr = signal(mut([1, 2, 3]));
  let updateCount = 0;
  
  effect(() => {
    arr.value; // Track whole array
    updateCount++;
  });
  
  arr.value.push(4); // Should trigger
  expect(updateCount).toBe(2);
  
  arr.value = []; // Reference change should trigger
  expect(updateCount).toBe(3);
});
```

## Future Primitives

Additional primitives require:
1. Common use case that cannot be solved with existing APIs
2. Fundamentally different reactive behavior
3. Performance benefit from core integration


## Design Decisions and Tradeoffs

### Design Rationale

**Prototype Enhancement**: Enables direct method calls with zero indirection. V8 optimizes prototype chains efficiently.

**Hybrid Tracking**: Arrays use method patching + minimal proxy for indices, objects use defineProperty for known properties.

**Marker Pattern**: Declaration-time detection keeps runtime checks out of hot paths.

## Alternative Approaches Considered

### 1. Full Proxy Approach
```typescript
// Rejected: Larger bundle, debugging complexity
new Proxy(value, { /* trap all operations */ });
```

### 2. Runtime Middleware Chain
```typescript
// Rejected: Adds checks to hot path
signal.use(['mut']);
```

### 3. Wrapper Classes
```typescript
// Rejected: Multiple objects, memory overhead
new MutSignal(signal(value));
```

### 4. Mixin Pattern
```typescript
// Rejected: Complex types, poor composition
Object.assign(signal, mutMixin);
```

## Limitations of Hybrid Approach

1. **Objects**: Dynamic property additions aren't tracked
2. **Nested Objects**: Only shallow mutations tracked
3. **Maps/Sets**: Future enhancement (not in initial implementation)

These limitations are acceptable trade-offs for the significant bundle size reduction and performance improvements.

## Implementation Timeline

- Core primitive system: 0.5 days
- Mut primitive implementation: 1 day
- Testing and benchmarks: 0.5 days
- Total: 2 days