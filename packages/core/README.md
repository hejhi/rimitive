# @rimitive/core

Simple, minimal Dependency Injection through module composition. Modules declare dependencies and `compose()` wires them together.

**[Full documentation](https://rimitive.dev/guides/custom-modules/)**

Additional features:

- [**fork**](#forkbase-freshmodules) - fresh instances of selected modules, shares everything else
- [**transient**](#transientmodule) - fresh instance per dependent instead of shared singleton
- [**lazy**](#lazymodule) - async module initialization
- [**override**](#overridemodule-replacements) - swap dependencies for testing or configuration
- [**merge**](#mergeservice-additions) - extend context with additional properties

Works standalone or as the foundation for rimitive's reactive system.

## Architecture

This is a **Dependency Injection (DI)** system using the **Composition Root** pattern:

| Concept                   | In @rimitive/core                                                |
| ------------------------- | ---------------------------------------------------------------- |
| **Inversion of Control**  | Modules declare dependencies; they don't instantiate them        |
| **Constructor Injection** | `create(deps)` receives resolved dependencies                    |
| **Composition Root**      | `compose()` is the single place where the object graph is wired  |
| **Scopes**                | Singleton (default), transient, or lazy (async)                  |
| **Transitive Resolution** | Pass only what you need; dependencies are included automatically |
| **Async Support**         | `lazy()` wrapper for modules with async `create()`               |

Think of it like npm for runtime:

```
package.json "dependencies"  →  Module declares dependencies
npm install / node_modules   →  compose() resolves the graph
import X from 'x'            →  deps available by name in create()
```

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

---

## compose(...modules)

Resolves the dependency graph and returns a composed service. Each module is instantiated once and shared (singleton by default).

```typescript
const svc = compose(Logger, Database, Cache);
```

Access modules as properties:

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

## override(module, replacements)

Swap dependencies without changing the original module. Useful for testing or environment-specific configurations.

```typescript
import { compose, override } from '@rimitive/core';

// Production uses real database
const prodSvc = compose(UserService);

// Testing uses mock database
const MockDB = defineModule({
  name: 'db',
  create: () => ({ query: () => mockData }),
});

const testSvc = compose(override(UserService, { db: MockDB }));
```

Replacements are matched by name. If the replacement has a different name, it's aliased automatically:

```typescript
const FileLogger = defineModule({
  name: 'fileLogger', // Different name
  create: () => ({ log: writeToFile }),
});

// FileLogger is aliased to 'logger' for this composition
compose(override(App, { logger: FileLogger }));
```

---

## transient(module)

Mark a module as transient - each dependent gets a fresh instance instead of sharing a singleton.

```typescript
import { compose, defineModule, transient } from '@rimitive/core';

const Logger = transient(
  defineModule({
    name: 'logger',
    create: () => new Logger(),
  })
);

const ServiceA = defineModule({
  name: 'serviceA',
  dependencies: [Logger],
  create: ({ logger }) => {
    /* unique logger instance */
  },
});

const ServiceB = defineModule({
  name: 'serviceB',
  dependencies: [Logger],
  create: ({ logger }) => {
    /* different logger instance */
  },
});

const svc = compose(ServiceA, ServiceB);
```

Transient modules still share their singleton dependencies:

```typescript
const Config = defineModule({ name: 'config', create: () => loadConfig() });

const Logger = transient(
  defineModule({
    name: 'logger',
    dependencies: [Config],
    create: ({ config }) => new Logger(config),
  })
);

// Each Logger instance shares the same Config
```

---

## fork(base, freshModules)

Create a new composition that shares instances from an existing one, but with fresh instances of specified modules. Useful for per-request contexts, test isolation, or scoped state.

```typescript
import { compose, fork, defineModule } from '@rimitive/core';

const Config = defineModule({ name: 'config', create: () => loadConfig() });
const DbPool = defineModule({ name: 'dbPool', create: () => createPool() });
const DbConnection = defineModule({
  name: 'dbConnection',
  dependencies: [DbPool],
  create: ({ dbPool }) => dbPool.getConnection(),
});

// Long-lived root composition
const root = compose(Config, DbPool, DbConnection);

// Per-request: fresh DbConnection, inherited Config and DbPool
const requestCtx = fork(root, [DbConnection]);

requestCtx.config; // Same instance (inherited from root)
requestCtx.dbPool; // Same instance (inherited from root)
requestCtx.dbConnection; // Fresh instance (not shared with root)

// Cleanup when done - only disposes fresh instances
requestCtx.dispose();
// root is unaffected
```

Fresh modules are:

- **Re-instantiated** - new instance, not shared with the base
- **Singleton within the fork** - shared by dependents in the forked context
- **Independently disposable** - disposing the fork only cleans up its fresh instances

**Rebinding dependencies:** Pass a replacement module with the same name to swap implementations:

```typescript
const MockDb = defineModule({ name: 'db', create: () => mockDb });

// UserService now receives MockDb instead of the original
const testCtx = fork(root, [MockDb, UserService]);
```

---

## lazy(module)

Mark a module with async `create()` as lazy. Lazy modules are awaited during composition, allowing async initialization like database connections or remote config loading.

```typescript
import { compose, defineModule, lazy } from '@rimitive/core';

const DbPool = lazy(
  defineModule({
    name: 'dbPool',
    create: async () => {
      const pool = await createPool();
      await pool.connect();
      return pool;
    },
  })
);

// compose() returns a Promise when lazy modules are present
const svc = await compose(DbPool, UserService);

// After await, everything is resolved - sync access
svc.dbPool.query('SELECT 1');
```

Async modules **must** be wrapped with `lazy()` - you'll get both a type error and runtime error otherwise.

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
