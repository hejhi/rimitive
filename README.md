<p align="center">
  <img src="assets/rimitive-logo.png" alt="Rimitive" width="200" />
</p>

<p align="center">
  <a href="https://github.com/hejhi/rimitive/actions/workflows/ci.yml"><img src="https://github.com/hejhi/rimitive/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@rimitive/signals"><img src="https://img.shields.io/npm/v/@rimitive/signals" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0+-blue" alt="TypeScript"></a>
</p>

# Rimitive

Type-safe reactive primitives, atomic tooling, and compositional patterns you can use anywhere:

- Add signals to your no-build vanilla js project
- Build a headless design system with portable, reactive UI logic
- Write UI components for any javascript environment or platform
- Create a full stack SSR-with-streaming app

All constructed on a foundation of reactive primitives. Rimitive is built for low commitment and no framework lock-in. Take as much or as little of it as you want, and easily customize, extend, or replace along the way.

## Quickstart

### Install and Create a Service

```bash
npm install @rimitive/core @rimitive/signals
```

Rimitive allows you to create isolated reactive services (with no leakage or pollution of global state) through composition:

```ts
import { compose } from '@rimitive/core';

// 1. Import the modules you want to use
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';

// 2. Create a reactive service for your app or portable component
const { signal, computed, effect } = compose(
  SignalModule,
  ComputedModule,
  EffectModule
);

// 3. Use it wherever you want, no build or transpilation required
const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => console.log(doubled())); // logs: 0

count(1); // logs: 2
count(2); // logs: 4
```

If that's what you came for, you can stop here and use this in your vanilla js app or use/write bindings to bring Rimitive signals to other frameworks!

### Add Some UI

If you don't want to opt-in to a reactive framework like React, you can use Rimitive to tack on only the UI you need, complete with **fine-grained reactivity**:

```bash
npm install @rimitive/view
```

```ts
import { createElModule } from '@rimitive/view/el';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { MountModule } from '@rimitive/view/deps/mount';

const { signal, computed, el, mount } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  // 👇 As easy as adding some new modules or module factories to your service
  createElModule(createDOMAdapter()),
  MountModule
);

const Counter = () => {
  const count = signal(0);

  return el('div')(
    el('span')(computed(() => `Count: ${count()}`)),
    el('button').props({ onclick: () => count(count() + 1) })('Increment')
  );
};

document.body.appendChild(mount(Counter()).element!);
```

Fun fact: UI "components" in Rimitive are just a function—they never re-render. They return a **spec** of a UI that can be mounted and unmounted...that's it. No build or transpilation required!

### Create Some Behaviors

A **behavior** is a pattern for encapsulating reactive state and actions into a reusable function (inspired by [SAM](https://sam.js.org/) and [downshift](https://www.downshift-js.com/)):

```ts
const useDisclosure = (initialOpen = false) => {
  const isOpen = signal(initialOpen);

  return {
    isOpen,
    open: () => isOpen(true),
    close: () => isOpen(false),
    toggle: () => isOpen(!isOpen()),
  };
};

// Use it anywhere
const disc = useDisclosure();
disc.open();
```

`use*` is just a naming convention; it doesn't confer any reactive superpowers like other frameworks, and there's no rules. This is just a pattern.

### Composition and Portability

Instead of directly importing from a shared service, you can wrap functions for service injection:

```ts
// Instead of importing directly...
const useDisclosure = (initialOpen = false) => {
  const isOpen = signal(initialOpen); // signal comes from somewhere
  // ...
};

// ...receive what you need
const disclosure =
  ({ signal }: Service) =>
  (initialOpen = false) => {
    const isOpen = signal(initialOpen);
    // ...
  };

// Then wire it up
const useDisclosure = svc(counter); // svc provides signal, computed, etc.
```

The same pattern works for components and ergonomic composition:

```ts
const dropdown = (svc: Service) => {
  // Compose other components or behaviors in the service closure
  // Runs a single time (not on every mount/unmount)
  const useDisclosure = svc(disclosure);

  return (options?: { initialOpen?: boolean }) => {
    const disc = useDisclosure(options?.initialOpen ?? false);

    // Add keyboard handling
    // Look ma, no memoization required! Remember? No re-rendering?
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      disc.toggle();
    };

    return {
      ...disc,
      onKeyDown,
    };
  };
};

// Wire it up
const Dropdown = svc(dropdown);
const app = svc.mount(Dropdown());
```

Typing is a breeze:

```ts
export const svc = compose(SignalModule, ComputedModule);
export type Service = typeof svc;

const myComponent = ({ signal, computed }: Service) => {
  return () => // ...
};
```

Now you're a Rimitive expert! Everything else simply builds on top of this. Routing, data fetching, even SSR (with or without streaming)—they all work the same way. This just demonstrates the beginnings of what's possible with Rimitive.

---

## The stack

Rimitive is intentionally layered, allowing you to opt-in only as needed.

```
┌─────────────────────────────────────────┐
│  Domain Tooling                         │
│  view (el, map), router, resource, etc  │
├─────────────────────────────────────────┤
│  Adapters                               │
│  DOM, SSR, canvas, your own             │
├─────────────────────────────────────────┤
│  Reactive Core                          │
│  signal, computed, effect, etc          │
└─────────────────────────────────────────┘
```

- **Reactive core** — `signal`, `computed`, `effect`, etc. The foundation everything else is built with.
- **Domain tooling** — `el`, `map`, etc for views, `matches` for routing, `resource` for data. Each domain provides (but does not prescribe) tools built on the reactive core. Create your own!
- **Adapters** — Plug in where you want it to run, and the types flow through. DOM, SSR, logic-only (for hydration or testing), or roll your own. Any UI that can be modeled as a tree can have an adapter.

Each layer is tiny, opt-in, swappable, and extensible. Use just the signals, plug in only the views you need later, or bring behaviors to other frameworks like React.

---

## Packages

| Package                                   | Layer          | What it does                         |
| ----------------------------------------- | -------------- | ------------------------------------ |
| [`@rimitive/core`](packages/core)         | Core           | Wires modules together — `compose()` |
| [`@rimitive/signals`](packages/signals)   | Reactive core  | `signal`, `computed`, `effect`       |
| [`@rimitive/view`](packages/view)         | Domain tooling | View layer — `el`, `map`, `match`    |
| [`@rimitive/router`](packages/router)     | Domain tooling | Routing — `matches`, `navigate()`    |
| [`@rimitive/resource`](packages/resource) | Domain tooling | Async data fetching                  |
| [`@rimitive/ssr`](packages/ssr)           | Adapters       | Server-side rendering and streaming  |
| [`@rimitive/react`](packages/react)       | Bindings       | Use Rimitive behaviors in React      |

Start with `@rimitive/core` and `@rimitive/signals`. Add the rest as you need them.

## Advanced

### Adapters

Same code, different targets:

```ts
createElModule(createDOMAdapter()); // Browser
createElModule(createParse5Adapter()); // Server (SSR)
createElModule(myCanvasAdapter()); // Your own
```

### Extending

Create your own modules with `defineModule()`:

```ts
import { defineModule } from '@rimitive/core';

const LoggerModule = defineModule({
  name: 'logger',
  provides: { log: (msg: string) => console.log(`[app] ${msg}`) },
});

const { signal, log } = compose(SignalModule, LoggerModule);
```

See [Custom Modules](https://rimitive.dev/guides/custom-modules/) for the full picture.

---

## Status

Alpha. Tested, benchmarked, used in personal projects. Not yet battle-tested in production.

[Why Rimitive?](https://rimitive.dev/why/) — the story behind the project.

[Get started →](https://rimitive.dev/guides/getting-started)
