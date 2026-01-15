# Rimitive

_"Primitive" was taken so I dropped the "P", naming is hard, leave me be_

## The Core Idea

(P)rimitive is about cherry-picking and composing reactive primitives as you need them:

```typescript
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule } from '@rimitive/signals/extend';

const svc = compose(SignalModule, ComputedModule);

svc.signal(0);         // access the primitives
svc.computed(() => …); // through the composed service
```

- A **module** (SignalModule, ComputedModule, etc) defines a primitive and its dependencies
- **Composition** resolves the dependency graph and creates a service
- Create as many or as few services as you'd like, with completely independent reactive graphs

`compose()` is the backbone of Rimitive—a type-safe way to wire primitives together.

A difference between rimitive and most reactive frameworks is that all reactivity is encapsulted in primitives. Therefore, there is:

- no over-arching reactive component framework
- no VDOM
- no concept of framework-level (or even component-level) reconciliation
- no concept of component re-renders

In fact, "components" in rimitive are just _patterns_. I recommend some component patterns you can try out to see what works best for your use cases, but you are free to improvise your own! 🎶

---

## Primitive Modules and Services

Here is the simplest, most minimal usage of rimitive:

```ts
import { compose } from '@rimitive/core';
import { SignalModule } from '@rimitive/signals/extend';

const { signal } = compose(SignalModule);
const count = signal(0);

count(); // read: 0
count(1); // write: 1
count(); // read: 1
```

Breaking this down:

1. `compose(SignalModule)`: create a reactive service with only the primitives you want (just literally signals, in this case)
2. use whatever primitives you want from the service returned
3. that's it! Create as many services as you need, or just a single one for your entire app

The foundation of rimitive is:

- **Primitives** are exported as "modules" (like `SignalModule`)
- **Services** are compositions of these modules

Rimitive also provides some higher-level libraries that work and wrap modules and services, like `router` and `ssr`.

---

## Using rimitive Primitives

Here's a slightly larger example, this time with view primitives too!

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
  createElModule(createDOMAdapter()), // Provide the adapter to a primitive
  MountModule
);
```

Use the service in a component:

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

Rimitive is renderer-agnostic, so some modules (like `createElModule`) take an adapter. Use ours our write your own. rimitive provides a DOM adapter, SSR adapter (which uses linkedom under the hood) and a hydration adapter (for SSR).

Again, components don't "re-render". rimitive hates magic (but loves factories 🏭). Also, if you hate any/all of our out-of-the-box primitives, you can write your own damn custom modules❤️.

And that's about all there is to using rimitive. The rest of rimitive is all about patterns (we document many) and primitives (explore our packages and documentation).

---

## Extensibility

Want to:

- **Create custom modules?** Use `defineModule()` with the same patterns rimitive uses internally
- **Swap out the reactive system?** Replace the dependency modules with your own (or someone else's), or even swap out entire primitives for something else
- **Build a custom adapter/renderer?** Implement the `Adapter` interface for Canvas, WebGL, or anything tree-based
- **Add instrumentation?** Compose with `createInstrumentation()` for debugging; instrumentation is first-class in rimitive

rimitive provides modules for reactivity and UI out of the box, but they're not special. In fact, they're built with the same tools rimitive provides to you. rimitive at its core is a simple, type-safe composition pattern, so it can be used for creating lots of tools, not just reactive frameworks.

---

## FAQ

1. Why?

See the section at the bottom of this README. It's lengthy but useful if you're seriously considering rimitive to understand why I might embark on such an adventure.

2. Is it fast/tiny/etc?

Yes, here's some emojis to demonstrate:

- ⚡️ performance is on par with preact and alien signals (see our [benchmarks](https://rimitive.dev/benchmarks/))
- 📦 bundle sizes are tiny and gruesomely tree-shake-able. No compilation required—compose only what you need regardless, and unless a package or module is specifically for the DOM, it's entirely environment agnostic and concurrency safe.
- 🌝 type-safe all the way down

3. Will it work with [my favorite framework]?

Only react bindings so far, but look at those bindings, it's so simple. Try writing one "yourself" (ie with Claude) with the ergonomics you prefer! No bindings needed for vanilla ts.

4. Are there docs and examples?

Yes, in abundance.

5. Are there devtools?

A bit noisy and perhaps overly granular, but yes (and written entirely with rimitive!).

6. Are there tests?

Many.

7. Concurrency-safe?

Absolutely! No module-level or global state to speak of.

8. rimitive primitives??

I SAID BEFORE. Leave. me. be.

---

## Inspirations

rimitive draws from libraries and ideas by brilliant people that have shaped how I think about reactivity and composition, and what I want in my nerd life:

- [alien-signals](https://github.com/stackblitz/alien-signals) and [reactively](https://github.com/milomg/reactively) — push-pull reactivity, graph coloring
- [downshift](https://www.downshift-js.com/use-select/) — headless, portable UI behavior
- [jotai](https://jotai.org/docs/core/atom) — atoms as configs, not values
- [ProseMirror](https://prosemirror.net) — extensibility and determinism

---

## Why Rimitive?

The story behind Rimitive—how it started, how it's going: [Why Rimitive?](https://rimitive.dev/why/)

---

## Status

Alpha. Tested, benchmarked, used in personal projects, _not_ battle-tested in production yet.
