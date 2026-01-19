<p align="center">
  <img src="assets/rimitive-logo.png" alt="Rimitive" width="200" />
</p>

# Rimitive

_"Primitive" was taken so I dropped the "P", naming is hard_

Rimitive is built for **progressive complexity** and **low up-front commitment**. Start with just signals in a vanilla TS file. Months later, you might have a full app with routing, SSR, and streaming—without rewrites, without migrations, without "now we need a real framework."

Compose only the primitives you need, opting in as you go, and even create your own reactive primitives that can tap directly into the rimitive reactive graph! 🎶

Rimitive is as much about providing **scalable patterns, conventions, and mental models** for building performant, lean, ergonomic, and scalable reactive applications as it is about providing the actual reactive primitives. Steal the patterns and use a different framework if you don't like rimitive!

Patterns and architectures in rimitive follow **low coupling, high cohesion**—your reactive logic is self-contained and reusable, your UI just consumes it. Test behaviors without rendering. Swap components without touching logic. Share behaviors across frameworks.

- **It's a reactive library, not a framework** — take only what you need, as you need it
- **No VDOM** — fine-grained updates directly to the DOM
- **No global state** — each `compose()` creates an isolated reactive context

📚 **[Full documentation at rimitive.dev](https://rimitive.dev)**

---

## Packages

| Package                                                 | Description                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| [`@rimitive/core`](packages/core)                       | Composition engine — `compose()`, `defineModule()`            |
| [`@rimitive/signals`](packages/signals)                 | Reactive primitives — `signal`, `computed`, `effect`, `batch` |
| [`@rimitive/view`](packages/view)                       | UI primitives — `el`, `map`, `match`, `portal`                |
| [`@rimitive/router`](packages/router)                   | Client-side routing                                           |
| [`@rimitive/resource`](packages/resource)               | Async data fetching with `resource()`                         |
| [`@rimitive/ssr`](packages/ssr)                         | Server-side rendering and streaming                           |
| [`@rimitive/react`](packages/react)                     | React bindings                                                |
| [`@rimitive/devtools-extension`](packages/devtools-extension) | Chrome DevTools extension ([download](https://github.com/hejhi/rimitive/releases)) |

---

## Modules and Services

Here is the simplest, most minimal setup of rimitive:

```ts
import { compose } from '@rimitive/core';
import { SignalModule } from '@rimitive/signals/extend';

const svc = compose(SignalModule);
```

Everything in rimitive is built from the SignalModule. Breaking this down, `compose(SignalModule)` returns a reactive service with only the primitives you provided.

That's it! Create services with only the primitives you need to use.

In addition to providing primitives, rimitive also provides higher-level tooling that work with and can help stitch together and orchestrate, like [`router`](https://rimitive.dev/guides/adding-routing/) and [`ssr`](https://rimitive.dev/guides/server-rendering/). It's simple to [make your own modules](https://rimitive.dev/guides/custom-modules/) as well.

---

## Using rimitive Primitives

Yes, rimitive primitives sounds ridiculous.

Anyway, here's a slightly larger example, this time with view primitives (and a DOM adapter)!

```typescript
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { MountModule } from '@rimitive/view/deps/mount';

const { signal, computed, el, mount } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(createDOMAdapter()), // Provide the DOM adapter to the view primitive
  MountModule
);
```

> Note: Rimitive primitives are environment-agnostic, so some modules (like `createElModule`) take an adapter. rimitive provides a DOM adapter, SSR adapter (which uses linkedom under the hood) and a hydration adapter (for SSR).

Now that you have a reactive service, you can use primitives from it however you'd like. For instance, you can create a reactive "component" by returning the `el` primitive from a function and providing the function to the `mount` primitive:

```typescript
const App = () => {
  const count = signal(0);

  return el('div')(
    el('p').props({ textContent: computed(() => `Count: ${count()}`) }),
    el('button').props({ onclick: () => count(count() + 1) })('Increment')
  );
};

document.body.appendChild(mount(App()).element!);
```

The component itself doesn't re-render, and neither does `el`—the element structure is created **once**. Only reactive props and text children update via fine-grained effects that target exactly one DOM property or text node (for reactive DOM structure, you can use primitives like [`map` and `match`](https://rimitive.dev/guides/rendering-lists/)).

That's about all there is to using rimitive! The rest is all about choosing the primitives and patterns you want to use—check out the [guides](https://rimitive.dev/guides/getting-started/) and [API reference](https://rimitive.dev/api/).

---

## Extensibility

Want to:

- **Create custom modules?** Use [`defineModule()`](https://rimitive.dev/guides/custom-modules/) with the same patterns rimitive uses internally
- **Swap out the reactive system?** Replace the dependency modules with your own (or someone else's), or even swap out entire primitives for something else
- **Build a custom adapter/renderer?** Implement the `Adapter` interface for Canvas, WebGL, or anything tree-based
- **Add instrumentation?** Compose with `createInstrumentation()` for debugging; instrumentation is first-class in rimitive

rimitive provides modules for reactivity and UI out of the box, but they're not special. In fact, they're built with the same tools rimitive provides to you. rimitive at its core is a simple, type-safe composition pattern, so it can be used for creating lots of tools, not just reactive frameworks.

---

## Inspirations

rimitive draws from libraries and ideas by brilliant people that have shaped how I think about reactivity and composition, and what I want in my nerd life:

- [alien-signals](https://github.com/stackblitz/alien-signals) and [reactively](https://github.com/milomg/reactively) — push-pull reactivity, graph coloring
- [downshift](https://www.downshift-js.com/use-select/) — headless, portable UI behavior
- [jotai](https://jotai.org/docs/core/atom) — atoms as configs, not values
- [ProseMirror](https://prosemirror.net) — extensibility and determinism

---

## Why Rimitive?

The story behind Rimitive—the impetus, how it started, how it's going: [Why Rimitive?](https://rimitive.dev/why/)

---

## Status

Alpha. Tested, benchmarked, used in personal projects, _not_ battle-tested in production yet.
