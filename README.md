# Lattice

> **DISCLAIMER:**
> This is alpha software—it's heavily tested and benchmarked, but the usual disclaimers apply.

## What is Lattice?

Lattice explores the idea of defining reactivity, components, and UIs as **specifications** and **services**, with a functional api.

- **spec**: a portable specification or definition—it describes _what_ something is (a behavior, a UI, a component) without being tied to any particular runtime, renderer, or framework
- **service**: a composed set of primitives (signals, effects, element builders) that can "hydrate" a spec into a reactive instance

```
spec + service = reactive instance
```

Traditional UI frameworks marry these together. A React component is both the definition and the runtime. A Solid component assumes Solid's reactivity. Lattice experiments with pulling them apart into functional specs that _define_ behavior and _receive_ strongly defined services, which are composed of primitives.

The result is a set of tree-shakeable toolkits, primitives, and patterns that enable defining and composing them, along with bindings and adapters for other frameworks. Aside from the dom adapter (which—obviously—uses the DOM) and the SSR DOM adapter (which uses linkedom under the hood), there's no DOM or external dependencies.

---

## Quick Example

Here's a simple counter. `App` is a spec of a UI component—it returns a `RefSpec` describing the UI. `mount` hydrates it into the DOM.

```typescript
import { createDOMSvc } from '@lattice/view/presets/dom';

const { el, signal, computed, mount } = createDOMSvc();

const App = () => {
  const count = signal(0);

  return el('div')(
    el('p').props({ textContent: computed(() => `Count: ${count()}`) }),
    el('button').props({ onclick: () => count(count() + 1) })('Increment')
  );
};

mount(App(), document.body);
```

The preset (`createDOMSvc`) bundles:

- `signals` (reactive primitives)
- `view` (reactive UIs)
- DOM adapter

But you can also compose services yourself:

```typescript
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { createDOMViewSvc } from '@lattice/view/presets/dom';

const signals = createSignalsSvc(); // Shared signals service
const dom = createDOMViewSvc(signals); // View services that use the same signals
const canvas = createCanvasViewSvc(signals); // your custom adapter
const position = signals.signal({ x: 0, y: 0 }); // Same signal, multiple rendering targets
```

Or go lower and compose individual primitives, or even swap out the entire underlying reactive system, if you want, by replacing the `helpers` yourself:

```typescript
import { compose } from '@lattice/lattice';
import { Signal, Computed, createHelpers } from '@lattice/signals';

const helpers = createHelpers();
const svc = compose({ signal: Signal(), computed: Computed() }, helpers);
```

Same idea at different levels: specs receive services, services are composed from primitives.

---

## Portable Behavior Specs

The impetus for this library was exploring the idea of defining strongly typed reactive behavior ahead of time, while decoupling it from a UI component. Inspired by libraries like:

- [downshift](https://www.downshift-js.com/use-select/):
  > You have a custom select dropdown in your application and you want it to perform exactly the same as the native HTML select in terms of accessibility and functionality. For consistency reasons, you want it to follow the ARIA design pattern for a select. You also want this solution to be simple to use and flexible so you can tailor it to your needs.
- [jotai atoms](https://jotai.org/docs/core/atom):
  > The atom function is to create an atom config. We call it "atom config" as it's just a definition and it doesn't yet hold a value. We may also call it just "atom" if the context is clear.
- The extensibility and determinism of [ProseMirror](https://prosemirror.net)
- The reactive FRP-ish algorithmic beauty and ergonomics of [alien-signals](https://github.com/stackblitz/alien-signals) and [Reactively](https://github.com/milomg/reactively), both of which Lattice signals is (**strongly**) modeled after (hybrid push/pull and graph coloring).

Lattice enables the creation of headless "behaviors" (a reactive behavioral spec, if you will)—simple functions that encapsulate reactive behavior, receive a service, and return a reactive api. This spec defines _what_ the behavior is; the service provides _how_ it becomes reactive.

Define a spec:

```typescript
export const counter =
  ({ signal, computed }: ReactiveSvc) =>
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

Use in Lattice views:

```typescript
const { use, el, computed } = createDOMSvc();

function Counter() {
  // `use` provides the spec with the current service
  const c = use(counter);
  return el('button').props({ onclick: c.increment })(
    computed(() => `Count: ${c.count()}`)
  );
}
```

Or in React:

```tsx
import { createHook, useSubscribe } from '@lattice/react';

// createHook provides the spec and hooks it into React's reactive model, but at the end of the day,
// `counter` is receiving a reactive service
const useCounter = createHook(counter);

function Counter() {
  const c = useCounter(10);
  const count = useSubscribe(c.count);
  return <button onClick={c.increment}>Count: {count}</button>;
}
```

One **very important distinction**: in Lattice, behavioral functions or components that return specs are **not** reactive closures that "re-render", like in most frameworks. Instead, reactive primitives are used to define reactive behavior and boundaries.

---

## Composing Specs

Specs can of course compose other specs as well. Consider open/close state—the same logic applies to accordions, dropdowns, modals, tooltips, and collapsible sections. We can capture that pattern once:

```typescript
// behaviors/disclosure.ts
export const disclosure =
  ({ signal, computed }: ReactiveSvc) =>
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

Now a `dropdown` spec can compose this with keyboard handling:

```typescript
// behaviors/dropdown.ts
export const dropdown = ({ use }: ReactiveSvc) => {
  const useDisclosure = use(disclosure); // `use` provides the service to disclosure
  return (options?: { initialOpen?: boolean }) => {
    const { close, isOpen, toggle, triggerProps, contentProps } = useDisclosure(
      options?.initialOpen ?? false
    );

    // ...
    return { isOpen, toggle, triggerProps, contentProps /** ... */ };
  };
};
```

The same `disclosure` spec could be composed into an accordion, modal, or tooltip—each adding its own semantics on top of the shared open/close logic.

---

## Specs Everywhere

This pattern also extends to views. When you write `el('div')(...)`, you're not _creating_ a DOM element—you're creating a `RefSpec`, a blueprint _of_ a dom element. The spec becomes a real element only once hydrated with an adapter.

```typescript
// This returns a RefSpec, not a DOM element
const Button = (label: string) =>
  el('button').props({ className: 'btn' })(label);

// The spec can be used multiple times
const save = Button('Save');
const cancel = Button('Cancel');

// mount() turns the specs into real DOM
mount(el('div')(save, cancel), document.body);
```

The same spec can be provided with different services or composed as larger specs.
