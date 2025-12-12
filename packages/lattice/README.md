# @lattice/lattice

Core composition layer for Lattice applications.

This package provides `compose()` and `defineModule()` — the backbone of Lattice. Everything else in the ecosystem builds on these primitives.

## Quick Start

```typescript
import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';

const svc = compose(SignalModule, ComputedModule, EffectModule);

// Access primitives directly
const count = svc.signal(0);
const doubled = svc.computed(() => count() * 2);

// Or use the behavior pattern
const counter = svc((ctx) => (initial = 0) => {
  const value = ctx.signal(initial);
  return {
    value,
    increment: () => value(v => v + 1),
  };
});

const myCounter = counter(0);
```

---

## API

### compose(...modules)

Composes modules into a unified service. Dependencies are resolved automatically — pass what you need, Lattice figures out the rest.

```typescript
import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule } from '@lattice/signals/extend';

const svc = compose(SignalModule, ComputedModule);
```

Returns a `Use<T>` object that is both:
- **Callable**: `svc(behavior)` invokes a behavior with the service
- **An object**: `svc.signal`, `svc.computed`, etc. are directly accessible

#### Disposal

Every composed service has a `dispose()` method:

```typescript
const svc = compose(SignalModule, ComputedModule);

// Later, when done
svc.dispose();  // runs cleanup for all modules
```

### defineModule(definition)

Creates a module — the fundamental unit of composition.

```typescript
import { defineModule } from '@lattice/lattice';

const Logger = defineModule({
  name: 'logger',
  create: () => ({
    log: (msg: string) => console.log(msg),
  }),
});
```

#### With dependencies

Modules declare what they need. Dependencies are resolved by name:

```typescript
const Counter = defineModule({
  name: 'counter',
  dependencies: [Logger],
  create: ({ logger }) => {
    let count = 0;
    return {
      increment: () => {
        count++;
        logger.log(`Count: ${count}`);
      },
    };
  },
});

// Compose - Logger is included automatically
const { counter } = compose(Counter);
counter.increment();  // logs: "Count: 1"
```

#### Module definition options

```typescript
defineModule({
  // Required
  name: 'myModule',           // Unique name, becomes property on service
  create: (deps) => impl,     // Factory function, receives resolved deps

  // Optional
  dependencies: [OtherModule],      // Modules this depends on
  init: (ctx) => { ... },           // Called when module is created
  destroy: (ctx) => { ... },        // Called when service is disposed
  instrument: (impl, instr) => impl // Wrap impl for debugging
});
```

### merge(service, additions)

Extends a service with additional properties. The base service instances are preserved.

```typescript
import { compose, merge } from '@lattice/lattice';
import { SignalModule } from '@lattice/signals/extend';

const svc = compose(SignalModule);

// Add new properties
const extended = merge(svc, { theme: 'dark' });
extended.theme;   // 'dark'
extended.signal;  // same instance as svc.signal
```

Useful for passing context through a component tree:

```typescript
const App = (svc) => {
  const router = createRouter(svc);
  const childSvc = merge(svc, { router });

  return childSvc(Layout);
};
```

---

## Behaviors

The behavior pattern is a function that receives a service and returns an API:

```typescript
// Define behavior
const counter = (svc) => (initial = 0) => {
  const count = svc.signal(initial);
  return {
    count,
    increment: () => count(c => c + 1),
  };
};

// Use behavior
const svc = compose(SignalModule, ComputedModule);
const useCounter = svc(counter);
const myCounter = useCounter(0);

myCounter.count();     // 0
myCounter.increment();
myCounter.count();     // 1
```

Behaviors can compose other behaviors:

```typescript
const disclosure = (svc) => (initialOpen = false) => {
  const isOpen = svc.signal(initialOpen);
  return {
    isOpen,
    toggle: () => isOpen(v => !v),
  };
};

const dropdown = (svc) => (options) => {
  const useDisclosure = disclosure(svc);
  const d = useDisclosure(options?.initialOpen);

  return {
    ...d,
    onKeyDown: (e) => {
      if (e.key === 'Escape') d.isOpen(false);
    },
  };
};
```

---

## Instrumentation

Add debugging/profiling to your modules:

```typescript
import { compose, createInstrumentation, devtoolsProvider } from '@lattice/lattice';
import { SignalModule, ComputedModule } from '@lattice/signals/extend';

const svc = compose(SignalModule, ComputedModule, {
  instrumentation: createInstrumentation({
    providers: [devtoolsProvider()],
  }),
});
```

### Custom instrumentation

Modules can define how they're instrumented:

```typescript
const MyModule = defineModule({
  name: 'myModule',
  create: () => (value) => createImpl(value),
  instrument: (impl, instr) => (value) => {
    const instance = impl(value);
    instr.register(instance, 'myModule');
    return instance;
  },
});
```

---

## Types

```typescript
import type {
  Module,
  ModuleDefinition,
  Use,
  ServiceContext,
  InstrumentationContext,
  ComposedContext,
} from '@lattice/lattice';

// Module<TName, TImpl, TDeps> - a module type
// Use<TSvc> - the callable service returned by compose()
// ServiceContext - passed to init/destroy hooks
// InstrumentationContext - passed to instrument hook
```

### Extracting types

```typescript
import type { ModuleImpl, ModuleName } from '@lattice/lattice';

type SignalImpl = ModuleImpl<typeof SignalModule>;  // the signal function type
type SignalName = ModuleName<typeof SignalModule>;  // 'signal'
```

---

## Why Composition?

Direct exports would be simpler. Why compose?

1. **Isolation** — Each `compose()` creates an independent reactive context. Perfect for testing, SSR, or embedding multiple apps.

2. **Tree-shaking** — Only bundle what you use. Need signals without views? Compose only signals.

3. **Extensibility** — Swap any module. Replace the scheduler, add custom adapters, instrument for debugging.

4. **Dependency injection** — Modules declare what they need. Testing with mocks is straightforward.

```typescript
// Production
const svc = compose(SignalModule, ComputedModule, EffectModule);

// Testing - inject a mock logger
const testSvc = compose(SignalModule, MockLoggerModule);
```

---

## License

MIT
