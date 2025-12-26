# Rimitive

_"Primitive" was taken so I dropped the "P", naming is hard, leave me be_

## The Core Idea

(P)rimitive is about cherry-picking and composing reactive primitives (packaged as **modules**) into **services** that you can use with a functional api to compose reactive components.

```typescript
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule } from '@rimitive/signals/extend';

const svc = compose(SignalModule, ComputedModule);

svc.signal(0);         // access the primitives
svc.computed(() => …); // through the composed service
```

- A **module** defines a primitive and its dependencies
- **Composition** resolves the dependency graph and creates a service

`compose()` is the backbone of Rimitive—a type-safe way to wire modules together.

You might be wondering "why", in which case, jump to the "About" section at the bottom. It's lengthy but useful if you're seriously considering rimitive to understand why I might build such a thing. I tried to make it moderately fun.

---

## FAQ

1. Why?

See the last section at the bottom

2. Is it fast/tiny/etc?

Yes, and gruesomely tree-shake-able:

- `signals`: on-par with `alien-signals` in package size an perf (benchmarks)
- `view`: faster than preact signals for reconciliation (benchmarks focus heavily on lists, which use `map` and thus reconciliation, and not surprising considering signals performance is on-par with preact-signals perf), likely significantly faster for use cases not involving reconciliation, as there's no virtual DOM, and fine-grained reactivity (no "component" re-renders), but not expressly benchmarked, so it's only a hunch.
- package sizes: very, very small, and you only take what you need.

3. Will it work with [my favorite framework]?

I made react bindings, nothing else yet; but it's not hard to write them. You can definitely use it with vanilla js. I'll add more frameworks after I see how React goes; I think it will boil down to what conceptual mappings people prefer. Try writing one "yourself" (or with Claude or something) with the ergonomics you like!

4. Are there docs and examples?

Good lord, yes. And READMEs. I had to outsource some of it to Claude or I would have spent the rest of my life doing it, but I assure you I triple checked it. If you find AI slop or ANYTHING like that, tell me or put in a PR (I'm only human (though Claude is not)).

5. Are there devtools?

Extremely granular, but yes (and written entirely with rimitive!).

6. Are there tests?

So, so many.

---

## Primitive Modules and Services

- **Primitives** (and their dependencies) are exported as rimitive "modules"
- **Services** are compositions of these modules.

Used in a sentence: Rimitive provides libraries of pre-built reactive primitives (packaged as rimitive modules and factories) to be composed into reactive services:

| Package             | Modules                                                  |
| ------------------- | -------------------------------------------------------- |
| `@rimitive/signals` | `SignalModule`, `ComputedModule`, `EffectModule`, etc    |
| `@rimitive/view`    | `createElModule`, `createMapModule`, `createMatchModule` |

Rimitive also provides some higher-level libraries that work and wrap modules and services:

- `router`
- `ssr`

---

## Using Primitives

Compose them into a reactive service:

```typescript
// The extensibility backbone
import { compose } from '@rimitive/core';

// The reactive primitives themselves
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';

// The DOM adapter
import { createDOMAdapter } from '@rimitive/view/adapters/dom';

// The mounting helper
import { MountModule } from '@rimitive/view/deps/mount';

// Create the adapter
const adapter = createDOMAdapter();

// Compose the service
const { signal, computed, el, mount } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter), // Provide the adapter to a primitive
  MountModule
);
```

Use the service to create a component (or any pattern you can think of, really):

```typescript
// Write a simple factory that returns a specification of a UI (a "component" if you will)
const App = () => {
  const count = signal(0);

  return el('div')(
    el('p').props({ textContent: computed(() => `Count: ${count()}`) }),
    el('button').props({ onclick: () => count(count() + 1) })('Increment')
  );
};

document.body.appendChild(
  // Provide the element to `mount`, and append the underlying element
  mount(App()).element!
);
```

Rimitive is renderer-agnostic, so some modules (like `createElModule`) take an adapter. You can swap or create adapters as you need. For instance, rimitive provides a DOM adapter, but also an SSR adapter (which uses linkedom under the hood) and a hydration adapter. But you can create your own (for instance, a Canvas adapter), or even your own primitives.

Rimitive also doesn't believe in reactive components; or first-class components at all. In rimitive, all reactivity is encapsulated within primitives. Components don't "re-render", so there's no magic in component functions (like `App` in the above). They're really just factories.

---

## Custom Primitives

You can write/define your own primitive (or whatever you want, really) modules with `defineModule`:

```typescript
import { defineModule } from '@rimitive/core';

const Logger = defineModule({
  name: 'logger',
  create: () => ({
    log: (msg: string) => console.log(msg),
  }),
});

const svc = compose(SignalModule, Logger);
svc.logger.log('hello');
```

You control the composition. A natural benefit is that everything is fully tree-shakeable. For example, you can use signals without a view if you'd like (see the behavior pattern in the next section). You can even use '@rimitive/core' to compose your own libraries completely outside of rimitive; there's no concept of "reactivity", it's just a composition mechanism.

Everything else beyond this is patterns. Rimitive provides (but does NOT prescribe) ergonomic patterns you can use that will feel familiar for React devs. But you can create or use any patterns you want. In fact, I really look forward to seeing what people come up with.

---

## Patterns: Behaviors

Composable primitives are flexible in terms of component patterns you can use. One pattern is the **behavior**—a portable function that receives a service and returns a "headless component" (ie, a factory that can accept default arguments and return a reactive api):

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

Behaviors define _what_ the logic is, and accept a reactive service. Behaviors are also composable, and can compose other behaviors. Consider open/close state—the same logic applies to accordions, dropdowns, modals, tooltips.

Capture the behavior once:

```typescript
// behaviors/disclosure.ts
export const disclosure =
  ({ signal, computed }: SignalsSvc) =>
  (initialOpen = false) => {
    const isOpen = signal(initialOpen);

    // Export a reactive, semantic api
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

> NOTE: The below example names the behavior `useDisclosure`, but it's NOT a React hook and the "rules of hooks" do not apply, either in naming or usage. There's no magic here, it's just returning the api object above. I just think React nailed a naming convention; use whatever naming convention you prefer!

```typescript
// behaviors/dropdown.ts
export const dropdown = (svc: SignalsSvc) => {
  // Behaviors can compose other behaviors by passing the service through.
  // Here, we create useDisclosure in the outer service function for clarity, though
  // it would also be fine to do so in the inner function, though it would technically
  // run again on re-mount
  const useDisclosure = disclosure(svc); // Again, this is NOT a React hook!

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

// Usage: compose() returns a service that can call behaviors
const svc = compose(SignalModule, ComputedModule);
const useDropdown = svc(dropdown);
const dd = useDropdown({ initialOpen: false });
```

The same `disclosure` behavior could be composed into an accordion, modal, or tooltip—each adding its own semantics on top.

Because behaviors only depend on the service contract (not a specific framework), they're portable. The same behavior works in Rimitive views, React (via `@rimitive/react`), or any other integration that provides the service.

---

## Specs and Mounting

UI primitives like `el` and `map` produce **specs**—inert data structures that _describe_ UI:

> NOTE: Again, this is NOT React! Functions shown here are **not** reactive closures that "re-render" like in other frameworks. There's no implicit re-execution or magic. Reactivity lives in the **primitives** (`signal`, `computed`), NOT in component (or behavior) functions.

```typescript
// This returns a spec, not a DOM element
const Button = (label: string) =>
  el('button')(
    // Provide the children as arguments
    label
  );

// Specs can be stored and reused
const save = Button('Save');
const cancel = Button('Cancel');

// mount() turns specs into real DOM elements
document.body.appendChild(mount(el('div')(save, cancel)).element!);
```

Specs don't become real elements until mounted with an adapter. The same spec can be mounted with different adapters (DOM, SSR, test, etc) or composed into larger specs before mounting. A happy side-effect of this design is that it makes SSR straightforward, and adapters hot-swappable (for SSR, we hot-swap the dom adapter in for the hydration adapter after hydration is complete).

---

## Extensibility

You own the composition layer. Want to:

- **Create custom modules?** Use `defineModule()` with the same patterns Rimitive uses internally
- **Swap out the reactive system?** Replace the dependency modules with your own (or someone else's)
- **Build a custom adapter/renderer?** Implement the `Adapter` interface for Canvas, WebGL, or anything tree-based
- **Add instrumentation?** Compose with `createInstrumentation()` for debugging; instrumentation is first-class in Rimitive

Rimitive provides modules for reactivity and UI out of the box, but they're not special—they're built with the same tools you have access to. In fact, Rimitive at its core is a simple, type-safe composition pattern, so it can be used for creating lots of tools, not just reactive frameworks.

---

## Inspirations

Rimitive draws from libraries that shaped how I think about reactivity and composition:

- [alien-signals](https://github.com/stackblitz/alien-signals) and [Reactively](https://github.com/milomg/reactively) — push-pull reactivity, graph coloring
- [downshift](https://www.downshift-js.com/use-select/) — headless, portable UI behavior
- [jotai](https://jotai.org/docs/core/atom) — atoms as configs, not values
- [ProseMirror](https://prosemirror.net) — extensibility and determinism

---

## Why? (The "About" / "Story" Section)

You absolutely do not need to read the below, but if you're interested in _why in the hell_ I would do this and are easily excited, you might find it interesting.

As an engineer working with reactive frameworks since time immemorial (ie...over a decade?), I have found myself longing, time and time again, to shrug off reactive frameworks, while being able to continue writing reactive components and apps.

Meanwhile, I've always been interested in the idea of a "headless" component; the most notable execution of this idea to me was `downshift`.

It's _hard_ to write a fully accessible component; even _harder_ if you want to create an abstraction of it for a design system, and even _harder-er_ if you want to bridge it across frameworks. There's web component frameworks that help with this, certainly. But I wanted the ergonomics of signals, with the composability provided by a functional api, without the shadow DOM, without compilers, and without bringing a framework with me.

My goals were...well not simple, exactly:

- a simple, declarative, predictable, portable, type-safe, framework-and-environment agnostic way to model reactive behavior and UIs in a way that felt familiar to what we use today
- ergonomic functional composition and extensibility
- a clear, scalable mental model with no magic
- no compromising on tree-shaking/bundle size or performance

Originally, I didn't even think of primitives. I started with the `core` package (which i originally called `lattice`) as an extensibility and composition layer; nothing to do with reactivity, really at all. A way to allow myself to compose "plugins" and underlying dependencies in an ultra-light, type-safe manner. Thus, the `core` package is **extremely** minimal; I shan't tell you how long I spent writing code only to strip it back.

Then, I happend to be exploring the push-pull, graph coloring algorithm of alien-signals one day (as one does, and also, it is _magnificent_), and I was just completely inspired by how something so utterly powerful, performant, and expressive could be built so minimally.

The idea of reactive primitives is...captivating. Libraries like alien-signals, frameworks like Solid and Preact, as well as higher-level UI libraries like Radix, clearly demonstrate the value proposition to me.

I saw how primitives could lend themselves naturally to the design of "lattice" (`core`) in terms of modularity (particularly with the `alien-signals` implementation of internal bit-flags and private objects). I was inspired to see if I could use the same algorithm and patterns to build my own signal primitives as "modules" with shared dependencies to test the composability/extensibility story of `core`. It took a minute to wrap my head around it, but it turned out better than I expected.

I got carried away with the idea of extending this model of composable primitives beyond state to the UI itself, with two additional constraints:

- I wanted "components" to be a _pattern_, not a _prescription_, with complete encapsulation of reactivity contained within primitives (I didn't want to build a component framework).
- I didn't want a virtual DOM, or to worry about "re-renders" of components, I didn't want a framework to "own" the tree.
- I wanted minimal, scarce reconcilation, encapsulated and specialized to only the primitives that needed it (really just the `map` primitive, which for a dead simple reactive app is not even needed).
- I wanted to be able to hot-swap renderers on the fly.

In order to swap renderers, I would need a clean abstraction that didn't couple itself to ideas of the DOM. So instead of "renderers", I went with the idea of **adapters** that abstracted the idea of the UI tree while encapsulating any renderer (or runtime) specific logic without leaking internals into primitives.

It took another lengthy and frustrating period of nights-and-weekends to build, strip, and tune it, but `view` was the culmination of that.

I felt that the primitive story was complete, so I wanted to build some higher-level tooling that would make it easier to actually build an app. The logical next step was a (very barebones) reactive router (`@rimitive/router`) that would work with `view`, which came together rather quickly, as well as some additional async tooling (`@rimitive/resource`).

I wanted to see how SSR and streaming would work. It was less challenging than I expected; the heavy lifting was actually more on the hydration side of things, and it came together rather elegantly with two adapters—one for rendering to a string on the server (with linkedom), and one for hydrating on the client, which would then get hot-swapped with the DOM (or whatever user-provided) client renderer upon completion.

The more I worked through tooling, the more it all just felt...well, kinda nice. Additionally, with the module and service patterns, I (or any user really) can replace any primitives they want, borrowing any dependencies they want, without needing to re-write the entire system or clone the repo.

Yes, there is boilerplate to creating a service. But there is also no _magic_, which was important to me. Composing a service is about composing the reactivity you will actually use; it's not as low-level as writing your own reactive primitives/libraries/framework, but not as high-level as React/Solid/Svelte, etc. This middle-ground is where I, personally, have found myself happiest living.

Time will tell where reactive primitives lead, but for now, I'm quite satisfied with `rimitive`, despite the ridiculous name.

And fun note: LLMs seem to grok it quite easily despite having 0 training data, as of early 2026; I've been using it a lot for personal projects. They stumble a bit trying to return `el`s in computeds instead of `map`, but after a few examples in the code base and a little note in `CLAUDE.md`, they chill out.

---

## Status

Alpha. Heavily tested and benchmarked, used in personal projects, but not battle-tested in production. If you're interested in composable reactivity and portable patterns, take a look around and hit me up!
