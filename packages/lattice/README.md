# @lattice/lattice

Service composition layer for Lattice. Wire independent packages together into unified contexts with lifecycle management and optional instrumentation.

> **Note**: Most users don't need this package directly. Use presets from `@lattice/signals` or `@lattice/view` instead. This package is for power users who need custom composition, instrumentation, or are building reusable libraries.

## When to Use This Package

| Use Case                        | What to Use                                        |
| ------------------------------- | -------------------------------------------------- |
| Building a typical app          | `createDOMView()` from `@lattice/view/presets/dom` |
| Sharing signals across adapters | `compose()` from this package                      |
| Adding instrumentation          | `createInstrumentation()` from this package        |
| Creating custom primitives      | `defineService()` from this package                |

## Overview

Lattice packages (`@lattice/signals`, `@lattice/view`, etc.) expose service factories—functions that create service definitions. This package composes those definitions into a single context object where each service is accessible by name.

```typescript
import { compose } from '@lattice/lattice';
import { Signal, Computed, Effect, deps } from '@lattice/signals';

const ctx = compose(
  { signal: Signal(), computed: Computed(), effect: Effect() },
  deps()
);

// Services available by name
ctx.signal(0);
ctx.computed(() => /* ... */);

// Cleanup when done
ctx.dispose();
```

## Core Concepts

### Service Definitions

A service definition is a plain object with a name, implementation, and optional lifecycle hooks:

```typescript
import { ServiceDefinition } from '@lattice/lattice';

const counterService: ServiceDefinition<
  'counter',
  { count: () => number; increment: () => void }
> = {
  name: 'counter',
  impl: {
    count: () => value,
    increment: () => value++,
  },
  init(ctx) {
    // Called when added to a context
  },
  destroy(ctx) {
    // Called when context is disposed
  },
};
```

### Composition

`compose` merges service definitions into a typed context:

```typescript
const ctx = compose(serviceA, serviceB, serviceC);

// Type-safe access to each service's impl
ctx.serviceA.doSomething();
ctx.serviceB.doSomethingElse();
```

Duplicate service names throw at composition time.

### Lifecycle Management

Services can register cleanup functions and check disposal state:

```typescript
const resourceService: ServiceDefinition<'resource', () => Resource> = {
  name: 'resource',
  impl: () => createResource(),
  adapt(impl, ctx) {
    return () => {
      if (ctx.isDestroyed) {
        throw new Error('Context disposed');
      }
      const resource = impl();
      ctx.destroy(() => resource.cleanup());
      return resource;
    };
  },
};
```

The `adapt` hook wraps the implementation with context-aware behavior—disposal checks, tracking, etc.

### Instrumentation

Add debugging and profiling without changing service implementations:

```typescript
import {
  compose,
  createInstrumentation,
  devtoolsProvider,
} from '@lattice/lattice';

const instrumentation = createInstrumentation({
  enabled: import.meta.env.DEV,
  providers: [devtoolsProvider()],
});

const ctx = compose(services, deps, { instrumentation });
```

Services that support instrumentation define an `instrument` hook:

```typescript
const myService: ServiceDefinition<'my', MyImpl> = {
  name: 'my',
  impl: myImplementation,
  instrument(impl, instrumentation, ctx) {
    // Wrap impl to emit events
    return {
      ...impl,
      doThing() {
        instrumentation.emit({
          type: 'my:doThing',
          timestamp: Date.now(),
          data: {},
        });
        return impl.doThing();
      },
    };
  },
};
```

## API

### `compose(factories, deps, options?)`

Create a context from service factories with shared dependencies:

```typescript
import { compose } from '@lattice/lattice';
import { Signal, Computed, Effect, deps } from '@lattice/signals';

const ctx = compose(
  { signal: Signal(), computed: Computed(), effect: Effect() },
  deps(),
  { instrumentation } // optional
);
```

### `compose(...services)`

Alternatively, create a context from pre-instantiated service definitions:

```typescript
const ctx = compose(serviceA, serviceB);
ctx.dispose(); // Cleanup all services
```

### `defineService(factory)`

Helper for creating portable, instantiable services. This is the pattern Lattice primitives use:

```typescript
// Define a service that requires dependencies
const MyPrimitive = defineService(
  (deps: { signal: SignalFactory }) => (options?: MyOptions) => ({
    name: 'myPrimitive',
    impl: createImpl(deps, options),
  })
);

// Usage: factory returns a Service with .create() method
const svc = compose({ myPrimitive: MyPrimitive() }, deps);
```

### `createInstrumentation(config)`

Create an instrumentation context for debugging and profiling:

```typescript
const instrumentation = createInstrumentation({
  enabled: import.meta.env.DEV,
  providers: [devtoolsProvider()],
});

const ctx = compose(factories, deps, { instrumentation });
```

### `devtoolsProvider(options?)`

Built-in instrumentation provider for Lattice DevTools:

```typescript
const instrumentation = createInstrumentation({
  providers: [devtoolsProvider({ debug: true })],
});
```

## Types

```typescript
// Service definition shape
type ServiceDefinition<TName extends string, TImpl> = {
  name: TName;
  impl: TImpl;
  adapt?(impl: TImpl, ctx: ServiceContext): TImpl;
  instrument?(
    impl: TImpl,
    instrumentation: InstrumentationContext,
    ctx: ServiceContext
  ): TImpl;
  init?(ctx: ServiceContext): void;
  destroy?(ctx: ServiceContext): void;
};

// Context provided to services
type ServiceContext = {
  destroy(cleanup: () => void): void;
  readonly isDestroyed: boolean;
};

// Instrumentation context
type InstrumentationContext = {
  contextId: string;
  contextName: string;
  emit(event: InstrumentationEvent): void;
  register<T>(
    resource: T,
    type: string,
    name?: string
  ): { id: string; resource: T };
};

// Resulting context type
type LatticeContext<TServices> = {
  [K in ServiceName<TServices[number]>]: ServiceImpl<TServices[number]>;
} & {
  dispose(): void;
};
```

## Installation

```bash
pnpm add @lattice/lattice
```

## License

MIT
