# Lattice

> **DISCLAIMER:**
> This is alpha software—it's heavily tested and benchmarked, but the usual disclaimers apply.

## The Core Idea

Lattice is built on two core concepts: **primitives** and **services**.

```typescript
import { compose } from '@lattice/lattice';

const service = compose(
  { signal: Signal(), computed: Computed() },
  dependencies
);

service.signal(0);         // use the primitives
service.computed(() => …); // through the service
```

- A **primitive** is a factory function—a building block
- A **service** is a composed set of primitives

At its core, that's it. `compose()` is the backbone of Lattice: a simple, type-safe way to wire primitives together with their dependencies.

---

## What Does That Unlock?

Lattice provides (but is not limited to!) pre-built primitives for **reactivity** and **UI**:

| Package            | Primitives                                  | What they produce        |
| ------------------ | ------------------------------------------- | ------------------------ |
| `@lattice/signals` | `signal`, `computed`, `effect`, `subscribe` | Reactive state & effects |
| `@lattice/view`    | `el`, `map`, `match`, `portal`              | UI specs                 |

These primitives produce different outputs:

- `signal(0)` → reactive state (live, tracks dependencies)
- `computed(() => ...)` → derived reactive value (live, lazy)
- `effect(() => ...)` → side effect (runs when dependencies change)
- `el('div')(...)` → spec (inert blueprint, needs hydration)
- `map(items, ...)` → fragment spec (inert, needs hydration)

---

## Using the Primitives

Most users won't need to call `compose()` directly. Lattice provides **presets**—pre-composed services, with their dependencies, ready to use:

```typescript
import { createDOMSvc } from '@lattice/view/presets/dom';

const useDomService = createDOMSvc();
const { el, signal, computed, mount } = useDomService();

const App = () => {
  const count = signal(0);

  return el('div')(
    el('p').props({ textContent: computed(() => `Count: ${count()}`) }),
    el('button').props({ onclick: () => count(count() + 1) })('Increment')
  );
};

mount(App(), document.body);
```

`createDOMSvc()` bundles signal primitives, view primitives, and a DOM adapter into one service. But it's just a convenience—under the hood, it's using `compose()`. If you want to replace any of them, you totally can. In fact, you can re-use our primitives and replace their underlying dependencies if you want to change their behavior. You have control down to the very base reactive, UI model, and renderer itself.

---

## Going Deeper: Compose Services Yourself

Need to share signals across multiple renderers? Compose services yourself:

```typescript
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { createDOMSvc } from '@lattice/view/presets/dom';

// Shared signals
const signals = createSignalsSvc();

// Multiple custom view services using the same signals
const dom = createMyDOMSvc(signals);
const canvas = createMyCanvasSvc(signals);

// Same signal, multiple rendering targets
const position = signals.signal({ x: 0, y: 0 });
```

That's essentially how Lattice does ssr in the `island` package (swapping out the renderer dependency for the `view` primitives). Or go lower and compose individual primitives:

```typescript
import { compose } from '@lattice/lattice';
import { Signal, Computed, Effect, deps } from '@lattice/signals';

const svc = compose(
  { signal: Signal(), computed: Computed(), effect: Effect() },
  deps()
);
```

Or write your own primitives, and hook directly into the underlying reactive model provided via our dependencies. You control the composition. Use presets for convenience, or compose only what you need. A natural benefit is that everything is fully tree-shakeable. Just need the signals in the vanilla DOM? Compose only that, with its base dependencies, and drop everything else.

---

## Patterns: Behaviors

Once you have primitives and services, patterns emerge. One such pattern is the **behavior**—a portable function that receives a service and returns a reactive API:

```typescript
// behaviors/counter.ts
export const counter =
  ({ signal, computed }: SignalsSvc) =>
  (initial = 0) => {
    const count = signal(initial);
    const doubled = computed(() => count() * 2);

    return {
      count,
      doubled,
      increment: () => count(count() + 1),
    };
  };
```

The behavior defines _what_ the logic is. The service provides the primitives. And behaviors can compose other behaviors. Consider open/close state—the same logic applies to accordions, dropdowns, modals, tooltips. Capture it once:

```typescript
// behaviors/disclosure.ts
export const disclosure =
  ({ signal, computed }: SignalsSvc) =>
  (initialOpen = false) => {
    const isOpen = signal(initialOpen);

    return {
      isOpen,
      open: () => isOpen(true),
      close: () => isOpen(false),
      toggle: () => isOpen(!isOpen()),
      triggerProps: computed(() => ({ 'aria-expanded': isOpen() })),
      contentProps: computed(() => ({ hidden: !isOpen() })),
    };
  };
```

Now a `dropdown` behavior can compose this with keyboard handling:

> NOTE: The below example names the behavior `useDisclosure`, but it's NOT a React hook and the "rules of hooks" do not apply, either in naming or usage. There's no magic here going on, it's just returning the api object above. I just think React nailed a naming convention. Name it whatever you want!

```typescript
// behaviors/dropdown.ts
export const dropdown = ({ use }: SignalsSvc) => {
  // `use` is a primitive that makes consuming the above pattern more ergonomic.
  // Don't like it? Roll your own and create your own patterns! The source (like most of Lattice) is tiny, promise.
  const useDisclosure = use(disclosure);

  return (options?: { initialOpen?: boolean }) => {
    const d = useDisclosure(options?.initialOpen ?? false);
    const handlers = {
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') d.close();
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          d.toggle();
        }
      },
    };

    return { ...d, handlers };
  };
};
```

The same `disclosure` behavior could be composed into an accordion, modal, or tooltip—each adding its own semantics on top.

Because behaviors only depend on the service contract (not a specific framework), they're portable. The same behavior works in Lattice views, React (via `@lattice/react`), or any other integration that provides the service.

---

## Specs and Hydration

UI primitives like `el` and `map` produce **specs**—inert data structures that _describe_ UI:

> NOTE: Again, this is NOT React! Functions shown here are **not** reactive closures that "re-render" like in other frameworks. There's no implicit re-execution. Reactivity lives in the **primitives** (`signal`, `computed`), not in component (or behavior) functions.

```typescript
// This returns a spec, not a DOM element
const Button = (label: string) =>
  el('button')(
    // provide the children as arguments
    label
  );

// Specs can be stored and reused
const save = Button('Save');
const cancel = Button('Cancel');

// mount() hydrates specs into real DOM
mount(el('div')(save, cancel), document.body);
```

Specs don't become real elements until hydrated with an adapter. The same spec can be hydrated with different adapters (DOM, SSR, test, etc) or composed into larger specs before hydration. A happy side-effect of this design is that it makes SSR much simpler.

---

## Extensibility

You own the composition layer. Want to:

- **Create custom primitives?** Use `defineService()` with the same patterns Lattice uses internally
- **Swap out our signals?** Replace `deps()` with your own reactive system (or someone elses)
- **Build a custom adapter/renderer?** Implement the `Adapter` interface for Canvas, WebGL, or anything tree-based
- **Add instrumentation?** Compose with `createInstrumentation()` for debugging; instrumentation is first-class in lattice

Lattice provides primitives for reactivity and UI out of the box, but they're not special—they're built with the same tools you have access to. In fact, Lattice at it's core is a simple, type-safe composition pattern, so it can be used for creating lots of tools, not just Reactive frameworks.

---

## Packages

| Package            | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `@lattice/lattice` | Core composition (`compose`, `defineService`)  |
| `@lattice/signals` | Reactive primitives (signal, computed, effect) |
| `@lattice/view`    | UI primitives with adapter system              |
| `@lattice/router`  | Routing with nested layouts                    |
| `@lattice/islands` | SSR and partial hydration                      |
| `@lattice/react`   | React bindings                                 |

---

## Inspirations

Lattice draws from libraries that shaped how I think about reactivity and composition:

- [alien-signals](https://github.com/stackblitz/alien-signals) and [Reactively](https://github.com/milomg/reactively) — push-pull reactivity, graph coloring
- [downshift](https://www.downshift-js.com/use-select/) — headless, portable UI behavior
- [jotai](https://jotai.org/docs/core/atom) — atoms as configs, not values
- [ProseMirror](https://prosemirror.net) — extensibility and determinism

---

## Status

Alpha. Heavily tested and benchmarked, but not battle-tested in production. If you're interested in composable reactivity and portable patterns, take a look around and hit me up!
