---
name: lattice-module
description: Create Lattice modules with defineModule. Use when adding new primitives, extending the signal system, creating adapters, or building composable functionality that integrates with compose().
---

# Creating Lattice Modules

Modules are the fundamental unit of composition in Lattice. They declare dependencies and provide an implementation that becomes available on the composed service.

## The Pattern

```typescript
import { defineModule } from '@lattice/lattice';

const MyModule = defineModule({
  name: 'myFeature',                    // becomes svc.myFeature
  dependencies: [OtherModule],          // optional, resolved by compose()
  create: ({ otherModule }) => {        // receives resolved deps
    // Return the implementation
    return { /* API */ };
  },
});
```

## Instructions

### 1. Define the module

```typescript
import { defineModule } from '@lattice/lattice';

export const LoggerModule = defineModule({
  name: 'logger',
  create: () => ({
    log: (msg: string) => console.log(`[LOG] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`),
  }),
});
```

### 2. With dependencies

Dependencies are other modules. They're resolved automatically by `compose()`.

```typescript
import { defineModule } from '@lattice/lattice';
import { SignalModule } from '@lattice/signals/extend';

export const CounterModule = defineModule({
  name: 'counter',
  dependencies: [SignalModule],
  create: ({ signal }) => (initial = 0) => {
    const count = signal(initial);
    return {
      count,
      increment: () => count(count() + 1),
    };
  },
});
```

### 3. Export types

Always export the implementation type for consumers:

```typescript
// Types for the implementation
export type Logger = {
  log: (msg: string) => void;
  error: (msg: string) => void;
};

// The module
export const LoggerModule = defineModule({
  name: 'logger',
  create: (): Logger => ({
    log: (msg) => console.log(`[LOG] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
  }),
});
```

### 4. Factory modules (for adapters)

When a module needs configuration, export a factory function:

```typescript
import { defineModule } from '@lattice/lattice';
import type { Adapter } from '@lattice/view/types';

export const createElModule = (adapter: Adapter) =>
  defineModule({
    name: 'el',
    dependencies: [EffectModule],
    create: ({ effect }) => {
      // Use adapter and effect to build el()
      return (tag: string) => { /* ... */ };
    },
  });

// Usage:
// const ElModule = createElModule(domAdapter);
// const svc = compose(ElModule);
```

## Module Lifecycle

### init / destroy

For modules that need setup/teardown:

```typescript
const ConnectionModule = defineModule({
  name: 'connection',
  create: () => {
    let conn: Connection | null = null;
    return {
      get: () => conn,
      connect: (url: string) => { conn = new Connection(url); },
    };
  },
  init: (ctx) => {
    // Called when module is added to context
    console.log('Connection module initialized');
  },
  destroy: (ctx) => {
    // Called when context is disposed
    ctx.connection?.close();
  },
});
```

### instrument

For debugging/profiling support:

```typescript
const SignalModule = defineModule({
  name: 'signal',
  dependencies: [GraphEdgesModule, SchedulerModule],
  create: ({ graphEdges, scheduler }) => createSignalFactory({ graphEdges, scheduler }),
  instrument: (impl, instr, ctx) => (initialValue) => {
    const sig = impl(initialValue);
    instr.register(sig, 'signal', { initialValue });
    return sig;
  },
});
```

## File Structure

```
packages/my-package/src/
├── index.ts          # Re-exports types
├── extend.ts         # Exports modules
├── my-feature.ts     # Module implementation
└── types.ts          # Type definitions
```

**index.ts** (types only):
```typescript
export type { MyFeature, MyOptions } from './types';
```

**extend.ts** (modules):
```typescript
export { MyFeatureModule } from './my-feature';
```

## Naming Conventions

- Module variable: `PascalCaseModule` (e.g., `SignalModule`, `BatchModule`)
- Module name property: `camelCase` (e.g., `'signal'`, `'batch'`)
- Factory function: `createXModule` (e.g., `createElModule`)

## Internal Dependencies

Some modules are internal implementation details. These go in `deps/`:

```
packages/signals/src/
├── signal.ts           # SignalModule (public)
├── computed.ts         # ComputedModule (public)
└── deps/
    ├── graph-edges.ts  # GraphEdgesModule (internal)
    └── scheduler.ts    # SchedulerModule (internal)
```

Internal modules are composed automatically when their dependents are used.

## Testing Modules

```typescript
import { compose } from '@lattice/lattice';
import { MyModule } from './my-module';

describe('MyModule', () => {
  it('provides the expected API', () => {
    const svc = compose(MyModule);

    expect(typeof svc.myFeature.doSomething).toBe('function');
  });

  it('integrates with dependencies', () => {
    const svc = compose(MyModule, OtherModule);

    // Test that they work together
    svc.myFeature.doSomething();
    expect(svc.otherModule.wasNotified()).toBe(true);
  });
});
```

## Common Module Types

- **Primitive modules**: `SignalModule`, `ComputedModule`, `EffectModule`
- **Adapter-bound modules**: `createElModule(adapter)`, `createMapModule(adapter)`
- **Helper modules**: `BatchModule`, `UntrackModule`, `OnModule`
- **Integration modules**: `MountModule`, `PortalModule`
