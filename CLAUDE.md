# CLAUDE.md

This file provides guidance for working with the Rimitive codebase. 

Make sure web searches use the ACTUAL current year. IGNORE YOUR TRAINING CUT-OFF which is NOT the current year.

## LLM Documentation

For comprehensive LLM-optimized documentation, see:

- `llms.txt` - Quick reference index
- `llms-full.txt` - Complete documentation (recommended for full context)

## Development Commands

```bash
# Build, test, typecheck, lint
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm check                        # all of the above

# Package-specific commands
pnpm --filter @rimitive/signals test
pnpm --filter @rimitive/signals test src/computed.test.ts
pnpm --filter @rimitive/signals test -- "should handle deep dependency"

# Benchmarks
pnpm bench
pnpm bench diamond
timeout 60 pnpm bench chain-deep
```

## Core Concepts

### Composition

Rimitive is built on module composition. `compose()` wires modules together, resolving dependencies automatically:

```ts
const svc = compose(SignalModule, ComputedModule, EffectModule);
const { signal, computed, effect } = svc;
```

Modules declare dependencies and provide implementations via `defineModule()`. See `packages/core/src/module.ts` for the pattern.

### Core APIs

The `@rimitive/core` package provides these composition utilities:

| API | Purpose |
|-----|---------|
| `compose(...modules)` | Wire modules together into a service |
| `defineModule({ name, deps, create })` | Define a new module |
| `merge(moduleA, moduleB)` | Combine two modules into one |
| `override(module, { dep: replacement })` | Replace a module's dependency |
| `fork(service)` | Create an isolated copy of a service |
| `transient(module)` | Mark module to create fresh instance per `fork()` |
| `lazy(module)` | Defer module creation until first access |

### Signal Modules

Import modules from `@rimitive/signals/extend`:

- `SignalModule` - reactive state (`signal(value)`)
- `ComputedModule` - derived values (`computed(() => ...)`)
- `EffectModule` - synchronous side effects (`effect(() => ...)`)
- `BatchModule` - batched updates (`batch(() => ...)`)
- `SubscribeModule` - external subscriptions
- `UntrackModule` - untracked reads

Signal API: `sig()` reads, `sig(value)` writes, `sig.peek()` reads without tracking.

Effects are **synchronous** - they run immediately when dependencies change. This is intentional and differs from React's useEffect.

**Flush strategies** for effects: `mt` (microtask), `raf` (requestAnimationFrame), `timeout`, or custom. These are no-ops on the server for SSR compatibility.

### View Modules

View modules are factory functions that take an adapter:

```ts
const adapter = createDOMAdapter();
const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter)
);
```

View tools:

- `el(tag).props({...})(...children)` - element specs
- `map(items, keyFn, render)` - reactive lists
- `match(reactive, matcher)` - conditional rendering
- `portal(target)(child)` - render to different DOM location
- `load(id, fetcher, render)` - async data loading for SSR

Specs are inert blueprints. Call `.create(svc)` or use `mount()` to instantiate.

### Behaviors

Behaviors are portable functions that receive a service and return an API:

```ts
const counter =
  (svc) =>
  (initial = 0) => {
    const count = svc.signal(initial);
    return {
      count,
      increment: () => count(count() + 1),
    };
  };

const useCounter = svc(counter);
```

Behaviors can compose other behaviors by passing the service through.

## Package Structure

```
packages/
├── core/              # Composition: compose, defineModule, merge, override, fork
├── signals/           # Reactive core (signal, computed, effect)
├── view/              # View layer (el, map, match, portal, load)
├── router/            # Client-side routing
├── resource/          # Async data fetching with resource()
├── ssr/               # Server-side rendering and hydration
├── react/             # React bindings
├── mcp/               # MCP server for LLM documentation
├── devtools-extension/ # Browser devtools
├── docs/              # Documentation site (Astro/Starlight)
├── benchmarks/        # Performance benchmarks
└── examples/          # Example applications
```

### Import Conventions

- **Modules**: `import { SignalModule } from '@rimitive/signals/extend'`
- **Types**: `import type { Readable, SignalFunction } from '@rimitive/signals'`
- **View factories**: `import { createElModule } from '@rimitive/view/el'`
- **Adapters**: `import { createDOMAdapter } from '@rimitive/view/adapters/dom'`
- **SSR**: `import { createParse5Adapter, renderToStringAsync } from '@rimitive/ssr/server'`

The `/extend` path exports modules and factory functions for composition. The base path exports types.

## SSR Overview

Three render modes:

| Function | Use Case |
|----------|----------|
| `renderToString` | Sync SSR, no async data |
| `renderToStringAsync` | Wait for all `load()` boundaries |
| `renderToStream` | Send shell immediately, stream data chunks |

Key patterns:
- Create fresh adapter/service per request (no cross-request leakage)
- Use `load(id, fetcher, render)` for async data boundaries
- Use `safeJsonStringify()` when embedding data in script tags
- Client hydration: `createHydrationAdapter()` + `switchToFallback()`

## Type Export Guidelines

When exporting types, ensure all referenced types are also exported. TS2742 ("The inferred type cannot be named...") occurs when a public type references an unexported internal type.

**Solution**: Export all constituent types from the same entry point. Users should never need explicit return type annotations.

## Testing

Tests are co-located with source files (`*.test.ts`). Key test files:

- `api.test.ts` - integration tests
- `detached-memory.test.ts` - memory leak tests

## Plugins

Project plugins in `plugins/` provide skills that activate when relevant:

| Plugin | Use When |
|--------|----------|
| `rimitive-behavior` | Creating reusable state logic, headless UI patterns |
| `rimitive-module` | Adding new primitives with `defineModule()` |
| `rimitive-view` | Building UI with `el`, `map`, `match` |
| `rimitive-compose` | Working with compose, fork, override |
| `rimitive-adapter` | Creating custom adapters |

## Git Workflow

Follow conventional commits: `fix:`, `feat:`, `docs:`, `chore:`, `test:`, `refactor:`

## Release Workflow

Packages are published to npmjs.org as public packages. Releases are triggered manually or via version tags.

```bash
# Option 1: Manual trigger
# Go to GitHub Actions → Release → Run workflow

# Option 2: Tag-based release
git tag v0.1.2
git push --tags
```

Both methods run the same workflow which uses changesets to version and publish packages.

### Creating a Changeset

Before releasing, create changesets for your changes:

```bash
pnpm changeset              # Interactive changeset creation
git add .changeset/
git commit -m "chore: add changeset"
```

### First-Time Publishing (New Packages)

OIDC trusted publishing cannot create new packages on npm - it can only publish to existing ones. For a brand new package:

```bash
# 1. Log in to npm (opens browser for auth)
npm login

# 2. Publish manually from the package directory
cd packages/new-package
npm publish --access public

# 3. Configure Trusted Publisher on npmjs.com
#    Go to: npmjs.com → @rimitive/new-package → Settings → Trusted Publishers
#    Add GitHub Actions: org=hejhi, repo=rimitive, workflow=release.yml
```

After the first publish, subsequent releases will work via the normal OIDC workflow.

Install packages: `pnpm add @rimitive/signals`

## Communication Principles

- **Direct**: Say what's wrong plainly.
- **Pragmatic**: Working solutions over elegant theory.
- **Concise**: Brief explanations.
- **Trust-based**: Don't over-explain obvious things.

**Never revert or abandon during implementation.** When blocked:

1. Analyze deeply to understand the fundamental problem
2. Strategize how to iterate through it
3. If fundamentally flawed or too ambiguous, stop and consult

Never change direction without explicit user instruction.
