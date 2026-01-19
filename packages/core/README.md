# @rimitive/core

A type-safe composition engine for building modular services. Define modules with dependencies, compose them together, get a fully-wired service.

This is the backbone of rimitive, but it works entirely on its own! No reactivity required. Use it to build libraries, DI containers, or any system where you want composable, testable modules.

## Quick Start

```typescript
import { compose, defineModule } from '@rimitive/core';

const Logger = defineModule({
  name: 'logger',
  create: () => ({
    log: (msg: string) => console.log(`[LOG] ${msg}`),
    error: (msg: string) => console.error(`[ERR] ${msg}`),
  }),
});

const Database = defineModule({
  name: 'db',
  dependencies: [Logger],
  create: ({ logger }) => ({
    query: (sql: string) => {
      logger.log(`Executing: ${sql}`);
      return []; // your db logic here
    },
  }),
});

const svc = compose(Database);

svc.db.query('SELECT * FROM users');
// [LOG] Executing: SELECT * FROM users
```

Dependencies resolve automatically. Pass what you need, and rimitive figures out the rest.

---

## compose(...modules)

Takes modules, returns a composed service.

```typescript
const svc = compose(Logger, Database, Cache);
```

The returned service is an object with all your modules:

```typescript
svc.logger.log('hi');
svc.db.query('SELECT 1');
```

When you're done, clean up:

```typescript
svc.dispose();
```

---

## defineModule(definition)

Create a module:

```typescript
const Cache = defineModule({
  name: 'cache',
  create: () => {
    const store = new Map();
    return {
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => store.set(key, value),
    };
  },
});
```

With dependencies:

```typescript
const UserService = defineModule({
  name: 'users',
  dependencies: [Database, Cache],
  create: ({ db, cache }) => ({
    getUser: (id: string) => {
      const cached = cache.get(id);
      if (cached) return cached;
      const user = db.query(`SELECT * FROM users WHERE id = ${id}`)[0];
      cache.set(id, user);
      return user;
    },
  }),
});
```

Full options:

```typescript
defineModule({
  name: 'myModule',              // becomes property on service
  create: (deps) => impl,        // factory, receives resolved deps
  dependencies: [OtherModule],   // what this module needs
  init: (ctx) => { ... },        // called on creation
  destroy: (ctx) => { ... },     // called on dispose
  instrument: (impl, instr) => impl  // wrap for debugging
});
```

---

## merge(service, additions)

Extend a service with extra properties:

```typescript
const svc = compose(Logger);
const extended = merge(svc, { env: 'production' });

extended.env; // 'production'
extended.logger; // same instance as svc.logger
```

Handy for passing context through a system:

```typescript
const App = (svc) => {
  const config = loadConfig();
  const childSvc = merge(svc, { config });
  return childSvc(Router);
};
```

---

## Instrumentation

Add debugging to your modules:

```typescript
import {
  compose,
  createInstrumentation,
  devtoolsProvider,
} from '@rimitive/core';

const svc = compose(Logger, Database, {
  instrumentation: createInstrumentation({
    providers: [devtoolsProvider()],
  }),
});
```

Modules define how they're instrumented:

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
