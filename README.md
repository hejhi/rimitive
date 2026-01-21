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

_"Primitive" was taken so I dropped the "P"_

Composable reactive primitives for TypeScript, with an awkward name but a lot of personality 🌝

Start with signals, add what you need as you go, and swap out anything you want.

```bash
npm install @rimitive/core @rimitive/signals
```

Rimitive grows with you starting from your most simple reactive use cases:

```ts
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';

const { signal, computed, effect } = compose(
  SignalModule,
  ComputedModule,
  EffectModule
);

const you = signal('🫸');
const rimitive = signal('🫷');
const highFive = computed(() => `${you()}💥${rimitive()}`);

effect(() => console.log(highFive())); // 🫸💥🫷
```

`compose()` wires modules together into a tiny, encapsulated, reactive service, with only what you asked for. But Rimitive takes primitives to another level, so hold onto your butts!

---

## Add a view layer

If you want to add a UI, sprinkle in some UI primitives:

```ts
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
  // Add these 👇
  createElModule(createDOMAdapter()),
  MountModule
);

const App = () => {
  const together = signal(false);

  return el('div')(
    el('p').props({
      textContent: computed(() => (together() ? '🫸💥🫷' : '🫸   🫷')),
    }),
    el('button').props({ onclick: () => together(!together()) })('High five!')
  );
};

document.body.appendChild(mount(App()).element!);
```

Rimitive does things _a little differently_:

1. The component function runs once
2. The DOM structure is created once
3. When `together` changes, only that one text node updates (no diffing, reconciliation, or component re-renders)

Reactivity lives in the primitives, not in components. No component re-renders! Just mounting and unmounting.

Rimitive primitives (yes it sounds absurd) are environment-agnostic, which is where adapters come into play—which is why `createElModule` takes an adapter.

Rimitive ships DOM, SSR, and hydration adapters, but you can write your own for whatever you want (Canvas, WebGL, or anything tree-shaped).

But that's just the beginning. Rimitive provides common tooling that utilizes these primitives, including routing, async loading, SSR, and streaming—all on-demand, swappable, extensible, and completely optional.

For the full picture, check out the [docs](https://rimitive.dev/guides/getting-started)!

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

## Extending

The modules that ship with Rimitive are built with the same `defineModule()` that's available to you:

```ts
import { defineModule } from '@rimitive/core';

const LoggerModule = defineModule({
  name: 'logger',
  provides: { log: (msg: string) => console.log(`[app] ${msg}`) },
});

const { signal, log } = compose(SignalModule, LoggerModule);
```

Create your own primitives! Swap out the entire reactive system if you want, or build adapters for new renderers. See the [Custom Modules](https://rimitive.dev/guides/custom-modules/) guide.

---

## AI

Just because Rimitive is brand new shouldn't mean an AI stumbles while trying to write idiomatic Rimitive code. [`@rimitive/mcp`](packages/mcp) provides an MCP server that exposes the entire Rimitive docs as meticulously tagged, searchable tools.

If you use [Claude Code](https://claude.ai/code), there are on-demand plugins too:

| Plugin                                           | Purpose                                      |
| ------------------------------------------------ | -------------------------------------------- |
| [`rimitive-behavior`](plugins/rimitive-behavior) | Headless behaviors — portable reactive logic |
| [`rimitive-module`](plugins/rimitive-module)     | Custom modules with `defineModule()`         |
| [`rimitive-view`](plugins/rimitive-view)         | Views with `el`, `map`, `match`              |

---

## Inspirations

Rimitive builds on ideas from _brilliant_ people who've thought deeply about reactivity and composition:

- [alien-signals](https://github.com/stackblitz/alien-signals), [reactively](https://github.com/milomg/reactively): push-pull reactivity, graph coloring, primitives in general
- [solidjs](https://www.solidjs.com), [radix](https://www.radix-ui.com): beautiful implementations of primitives in their respective domains
- [downshift](https://www.downshift-js.com/use-select): headless, portable UI patterns
- [jotai](https://jotai.org/docs/core/atom): treating atoms as configs rather than values
- [ProseMirror](https://prosemirror.net): extensibility and determinism

---

## Status

Alpha. Tested, benchmarked, used in personal projects. Not yet battle-tested in production.

[Why Rimitive?](https://rimitive.dev/why/) — the story behind the project.
