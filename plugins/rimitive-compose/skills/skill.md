---
name: rimitive-compose
description: Compose Rimitive services with the right modules. Use when setting up a new service, adding primitives, or understanding what modules to import and from where.
---

# Composing Rimitive Services

Rimitive uses `compose()` to wire modules together into a reactive service. This guide helps you choose the right modules and imports.

## Import Paths

```typescript
// Core composition
import { compose } from '@rimitive/core';

// Signal modules (from /extend path)
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  SubscribeModule,
  UntrackModule,
} from '@rimitive/signals/extend';

// View module factories (need an adapter)
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { createPortalModule } from '@rimitive/view/portal';
import { createLoadModule } from '@rimitive/view/load';

// Adapters
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { createSSRAdapter } from '@rimitive/ssr/adapter';
import { createHydrationAdapter } from '@rimitive/ssr/hydration';

// View helpers
import { MountModule } from '@rimitive/view/deps/mount';
import { OnModule } from '@rimitive/view/deps/addEventListener';

// Router
import { createRouter } from '@rimitive/router';

// Resource (async data)
import { createResource } from '@rimitive/resource';
```

## Common Service Configurations

### Signals Only (No UI)

For headless logic, state management, or Node.js:

```typescript
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';

const svc = compose(SignalModule, ComputedModule, EffectModule);
const { signal, computed, effect } = svc;
```

### Signals + Batching

When you need to batch multiple updates:

```typescript
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';

const svc = compose(SignalModule, ComputedModule, EffectModule, BatchModule);
const { signal, computed, effect, batch } = svc;
```

### Full View Service (Browser)

For building UI components:

```typescript
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { MountModule } from '@rimitive/view/deps/mount';
import { OnModule } from '@rimitive/view/deps/addEventListener';

const adapter = createDOMAdapter();

const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter),
  MountModule,
  OnModule
);

const { signal, computed, effect, el, map, match, mount, on } = svc;
```

### View Service with Router

Add client-side routing:

```typescript
import { compose, merge } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { MountModule } from '@rimitive/view/deps/mount';
import { createRouter } from '@rimitive/router';

const adapter = createDOMAdapter();

const baseSvc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter),
  MountModule
);

// Add router (uses merge because router needs the base service)
const router = createRouter(baseSvc);
const svc = merge(baseSvc, router);

const { signal, computed, el, map, match, mount, route, link, navigate } = svc;
```

### SSR Service

For server-side rendering:

```typescript
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { createSSRAdapter } from '@rimitive/ssr/adapter';

const adapter = createSSRAdapter();

const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter)
);
```

## Module Reference

| Module | Provides | Use When |
|--------|----------|----------|
| `SignalModule` | `signal()` | Always - core reactive state |
| `ComputedModule` | `computed()` | Deriving values from signals |
| `EffectModule` | `effect()` | Side effects on signal changes |
| `BatchModule` | `batch()` | Batching multiple updates |
| `SubscribeModule` | `subscribe()` | External subscriptions to signals |
| `UntrackModule` | `untrack()` | Reading without tracking |
| `createElModule(adapter)` | `el()` | Building DOM elements |
| `createMapModule(adapter)` | `map()` | Reactive lists |
| `createMatchModule(adapter)` | `match()` | Conditional rendering |
| `createPortalModule(adapter)` | `portal()` | Render to different DOM location |
| `createLoadModule(adapter)` | `load()` | Async component loading |
| `MountModule` | `mount()` | Mounting specs to DOM |
| `OnModule` | `on()` | Event listener helper with auto-batching |

## Adapter Pattern

View modules need an adapter because Rimitive is renderer-agnostic:

```typescript
// DOM (browser)
const adapter = createDOMAdapter();

// SSR (server)
const adapter = createSSRAdapter();

// Hydration (client, after SSR)
const adapter = createHydrationAdapter(ssrHtml);

// Custom (canvas, WebGL, etc.)
const adapter = createMyAdapter();
```

The same view code works with any adapter—swap adapters to change where/how elements render.

## Service Types

Export a type for your service to use in behaviors and components:

```typescript
// service.ts
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';

const adapter = createDOMAdapter();

export const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter)
);

// Export the service type for behaviors
export type Service = typeof svc;
```

Then use in behaviors:

```typescript
import type { Service } from './service';

const myBehavior = (svc: Service) => () => {
  const { signal, computed } = svc;
  // ...
};
```
