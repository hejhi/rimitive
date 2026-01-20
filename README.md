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

_"Primitive" was taken so I dropped the "P", naming is hard_

Rimitive is a set of composable libraries that provide:

- **reactive primitives** for state, views, routing, and async data
- **a composition system** to wire together only what you need
- **adapters and integrations** for DOM, SSR, React, and more

Rimitive uses the primitive construct with a tiny but powerful compositional library so you **avoid as much up-front commitment as possible**. You can start with just signals and computeds in your vanilla js app or reactive framework as you prototype, pulling in more Rimitive as you need (or not). The goal of Rimitive is to blend into your architecture, and allow you to easily package and re-use micro reactive services tailored to your needs.

The primitives:

- [`@rimitive/signals`](packages/signals): primitives for state management
- [`@rimitive/view`](packages/view): primitives for composing a reactive UI
- [`@rimitive/resource`](packages/resource): primitive for async data

The composition core:

- [`@rimitive/core`](packages/core): a strongly typed composition system that can be used outside of rimitive altogether

Additional packages provide [routing](https://rimitive.dev/guides/adding-routing/), [SSR](https://rimitive.dev/guides/server-rendering/), React bindings, and devtools. You can also [design your own modules](https://rimitive.dev/guides/custom-modules/).

No build or transpilation required. Everything tree-shakes.

---

Here is the most basic setup of rimitive:

```ts
import { compose } from '@rimitive/core';
import { SignalModule } from '@rimitive/signals/extend';

// `compose()` returns your reactive service
const { signal } = compose(SignalModule);
```

Add a computed to your reactive service:

```ts
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule } from '@rimitive/signals/extend';

// All wiring happens under the hood, as part of the module/service system. But you can
// customize or define your own modules, tapping directly into the reactive graph
// (or even replacing it if you want!)
const { signal, computed } = compose(SignalModule, ComputedModule);
```

Compose your own tiny, performant reactive services tailored to your use cases. This pattern scales all the way to the most complex use cases you can imagine.

With the ability to define your own modules, you can even create your own reactive primitives to work with or replace Rimitives! 🎶

---

In addition to the above, Rimitive does not prescribe ways to use primitives, but rather provides framework-agnostic **patterns, conventions, and mental models** for building performant, lean, ergonomic, and scalable reactive applications.

For instance, Rimitive provides patterns for creating components and headless components (or behaviors), but there's no capital-C components or magical reactive closures like you would find in most reactive frameworks. Reactivity lives entirely within the primitives.

Patterns and architectures in Rimitive focus on **low coupling, high cohesion**—focusing on keeping reactive logic self-contained and portable. Test behaviors without rendering, swap components without touching logic, and share behaviors across frameworks and environments.

Additionally:

- **No VDOM**: fine-grained updates directly to the DOM
- **Minimal reconciliation**: only primitives that need reconciliation have it
- **No global state**: each `compose()` creates an isolated reactive context, making it safe for React concurrency or usage on the server.

📚 **[Full documentation at rimitive.dev](https://rimitive.dev)**

---

## Packages

| Package                                                       | Description                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`@rimitive/core`](packages/core)                             | Composition engine — `compose()`, `defineModule()`                                                                    |
| [`@rimitive/signals`](packages/signals)                       | Reactive primitives — `signal`, `computed`, `effect`, `batch`                                                         |
| [`@rimitive/view`](packages/view)                             | UI primitives — `el`, `map`, `match`, `portal`, `load`                                                                |
| [`@rimitive/router`](packages/router)                         | Reactive routing — `matches`, `navigate()`, `query`                                                                   |
| [`@rimitive/resource`](packages/resource)                     | Async data fetching with `resource()`                                                                                 |
| [`@rimitive/ssr`](packages/ssr)                               | Server-side rendering and streaming                                                                                   |
| [`@rimitive/react`](packages/react)                           | React bindings                                                                                                        |
| [`@rimitive/mcp`](packages/mcp)                               | MCP server exposing Rimitive docs to LLMs                                                                             |
| [`@rimitive/devtools-extension`](packages/devtools-extension) | Chrome DevTools extension ([download](https://github.com/hejhi/rimitive/releases?q=devtools-extension&expanded=true)) |

---

## Using Rimitive Primitives

Yes, "Rimitive primitive" sounds ridiculous.

Anyway, here's a slightly larger example, with view primitives and a DOM adapter!

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

> Note: primitives are environment-agnostic, so some modules (like `createElModule`) take an adapter. Rimitive provides DOM, SSR, and hydration adapters—or write your own!

Now that you have a reactive service, you can use it however you'd like:

```typescript
// Note: this might _look_ like a capital-c Component, but it's not a magically reactive closure!
// This means no "re-rendering"—it mounts or unmounts. Das it.
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

Rimitive provides modules for reactivity and UI out of the box, but they're not special. In fact, they're built with the same tools rimitive provides to you. Rimitive at its core is a simple, type-safe composition pattern, so it can be used for creating lots of tools, not just reactive frameworks.

---

## Claude Code Plugins

If you use [Claude Code](https://claude.ai/code), these plugins teach Claude how to write idiomatic rimitive code:

| Plugin                                           | Description                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| [`rimitive-behavior`](plugins/rimitive-behavior) | Create headless behaviors — portable reactive logic without UI   |
| [`rimitive-compose`](plugins/rimitive-compose)   | Help composing services with the right modules and imports       |
| [`rimitive-module`](plugins/rimitive-module)     | Create custom modules with `defineModule()`                      |
| [`rimitive-view`](plugins/rimitive-view)         | Build views with `el`, `map`, `match`, and other view primitives |
| [`rimitive-adapter`](plugins/rimitive-adapter)   | Create custom adapters for Canvas, WebGL, or other renderers     |

Install via Claude Code: `/install-plugin github:hejhi/rimitive/plugins/<plugin-name>`

### MCP Server

For deeper integration, [`@rimitive/mcp`](packages/mcp) provides an MCP server that exposes Rimitive documentation as searchable tools:

```json
{
  "mcpServers": {
    "rimitive": {
      "command": "npx",
      "args": ["@rimitive/mcp"]
    }
  }
}
```

This gives Claude access to `search_api`, `get_module`, and `get_example` tools for looking up Rimitive documentation on demand.

---

## Inspirations

Rimitive draws from libraries and ideas by _brilliant_ people that have shaped how I think about reactivity and composition, and what I want in my nerd life:

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
