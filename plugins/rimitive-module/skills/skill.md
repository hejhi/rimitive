---
name: rimitive-module
description: Create Rimitive modules with defineModule. Use when adding new primitives, extending the signal system, creating adapters, or building composable functionality that integrates with compose().
---

# Creating Rimitive Modules

Modules are the fundamental unit of composition in Rimitive. They declare dependencies and provide an implementation that becomes available on the composed service.

Rimitive's composition system isn't limited to the built-in primitives. You can define your own modules with `defineModule` and compose them alongside signals, view, or anything else.

---

## The Pattern

```typescript
import { defineModule } from '@rimitive/core';

const MyModule = defineModule({
  name: 'myFeature', // becomes svc.myFeature
  dependencies: [OtherModule], // optional, resolved by compose()
  create: ({ otherModule }) => {
    // receives resolved deps
    // Return the implementation
    return { /* API */ };
  },
});
```

The `name` becomes the key on the composed service. Whatever `create` returns becomes the value.

---

## Basic Module

```typescript
import { defineModule, compose } from '@rimitive/core';

const LoggerModule = defineModule({
  name: 'logger',
  create: () => ({
    log: (msg: string) => console.log(`[LOG] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`),
  }),
});

const svc = compose(LoggerModule);
svc.logger.log('hello');
```

---

## Modules with Dependencies

Dependencies are other modules. They're resolved automatically by `compose()`.

```typescript
import { defineModule, compose } from '@rimitive/core';
import { SignalModule, ComputedModule } from '@rimitive/signals/extend';

const CounterModule = defineModule({
  name: 'counter',
  dependencies: [SignalModule, ComputedModule],
  create: ({ signal, computed }) => (initial = 0) => {
    const count = signal(initial);
    const doubled = computed(() => count() * 2);
    return {
      count,
      doubled,
      increment: () => count(count() + 1),
      decrement: () => count(count() - 1),
    };
  },
});

const svc = compose(CounterModule);
const myCounter = svc.counter(10);

myCounter.count();      // 10
myCounter.increment();
myCounter.count();      // 11
myCounter.doubled();    // 22
```

Dependencies are resolved automatically. You only need to pass the modules you want—`compose()` includes transitive dependencies.

---

## Module Lifecycle

Modules can hook into lifecycle events:

```typescript
const ConnectionModule = defineModule({
  name: 'connection',
  create: () => {
    const ws = new WebSocket('wss://example.com');
    return {
      send: (msg: string) => ws.send(msg),
      socket: ws,
    };
  },
  init: (ctx) => {
    // Called before create, useful for setup
  },
  destroy: (ctx) => {
    // Called when svc.dispose() is invoked
  },
});

const svc = compose(ConnectionModule);
// ... use the connection
svc.dispose(); // triggers destroy hooks
```

---

## Factory Modules (for Adapters)

When a module needs configuration, export a factory function:

```typescript
import { defineModule } from '@rimitive/core';
import type { Adapter } from '@rimitive/view/types';

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
const ElModule = createElModule(domAdapter);
const svc = compose(ElModule);
```

---

## Beyond Reactivity

Here's the thing: `@rimitive/core` has no concept of reactivity. It's just a composition mechanism. You can use it for anything:

```typescript
import { defineModule, compose } from '@rimitive/core';

const HttpModule = defineModule({
  name: 'http',
  create: () => ({
    get: (url: string) => fetch(url).then(r => r.json()),
    post: (url: string, data: unknown) =>
      fetch(url, { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  }),
});

const CacheModule = defineModule({
  name: 'cache',
  create: () => {
    const store = new Map<string, unknown>();
    return {
      get: <T>(key: string): T | undefined => store.get(key) as T,
      set: <T>(key: string, value: T): void => { store.set(key, value); },
      clear: () => store.clear(),
    };
  },
});

const ApiModule = defineModule({
  name: 'api',
  dependencies: [HttpModule, CacheModule],
  create: ({ http, cache }) => ({
    async getUser(id: string) {
      const cached = cache.get<User>(`user:${id}`);
      if (cached) return cached;

      const user = await http.get(`/api/users/${id}`);
      cache.set(`user:${id}`, user);
      return user;
    },
  }),
});

const svc = compose(ApiModule);
await svc.api.getUser('123');
```

This makes `compose()` useful for any library or application architecture—not just UI frameworks. You control what gets composed.

---

## Tree-Shaking

Because you explicitly compose modules, everything is fully tree-shakeable. If you don't use `EffectModule`, it won't be in your bundle:

```typescript
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule } from '@rimitive/signals/extend';

const svc = compose(SignalModule, ComputedModule);
// No effect or view code bundled
```

---

## Instrumentation

For debugging/profiling support:

```typescript
const SignalModule = defineModule({
  name: 'signal',
  dependencies: [GraphEdgesModule, SchedulerModule],
  create: ({ graphEdges, scheduler }) =>
    createSignalFactory({ graphEdges, scheduler }),
  instrument: (impl, instr, ctx) => (initialValue) => {
    const sig = impl(initialValue);
    instr.register(sig, 'signal', { initialValue });
    return sig;
  },
});
```

---

## Export Types

Always export the implementation type for consumers:

```typescript
export type Logger = {
  log: (msg: string) => void;
  error: (msg: string) => void;
};

export const LoggerModule = defineModule({
  name: 'logger',
  create: (): Logger => ({
    log: (msg) => console.log(`[LOG] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
  }),
});
```

---

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

---

## Naming Conventions

- Module variable: `PascalCaseModule` (e.g., `SignalModule`, `BatchModule`)
- Module name property: `camelCase` (e.g., `'signal'`, `'batch'`)
- Factory function: `createXModule` (e.g., `createElModule`)

---

## When to Create Modules

Create a module when you want to:

- **Add new primitives** to the composed service
- **Share infrastructure** (logging, http, storage) across behaviors
- **Encapsulate setup/teardown** with lifecycle hooks
- **Build your own libraries** on top of composition

For reusable reactive logic, prefer behaviors. Behaviors are simpler and don't require `defineModule`. Use modules when you need something that lives at the composition level.

---

## Testing Modules

```typescript
import { compose } from '@rimitive/core';
import { MyModule } from './my-module';

describe('MyModule', () => {
  it('provides the expected API', () => {
    const svc = compose(MyModule);

    expect(typeof svc.myFeature.doSomething).toBe('function');
  });

  it('integrates with dependencies', () => {
    const svc = compose(MyModule, OtherModule);

    svc.myFeature.doSomething();
    expect(svc.otherModule.wasNotified()).toBe(true);
  });
});
```

---

## Common Module Types

- **Primitive modules**: `SignalModule`, `ComputedModule`, `EffectModule`
- **Adapter-bound modules**: `createElModule(adapter)`, `createMapModule(adapter)`
- **Helper modules**: `BatchModule`, `UntrackModule`, `OnModule`
- **Integration modules**: `MountModule`, `PortalModule`
