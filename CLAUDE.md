# CLAUDE.md

This file provides guidance for working with the Lattice codebase.

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
pnpm --filter @lattice/signals test
pnpm --filter @lattice/signals test src/computed.test.ts
pnpm --filter @lattice/signals test -- "should handle deep dependency"

# Benchmarks
pnpm bench
pnpm bench diamond-simple
timeout 60 pnpm bench chain-deep
```

## Core Concepts

### Composition

Lattice is built on module composition. `compose()` wires modules together, resolving dependencies automatically:

```ts
const svc = compose(SignalModule, ComputedModule, EffectModule);
const { signal, computed, effect } = svc;
```

Modules declare dependencies and provide implementations via `defineModule()`. See `packages/lattice/src/module.ts` for the pattern.

### Signal Primitives

Import modules from `@lattice/signals/extend`:
- `SignalModule` - reactive state (`signal(value)`)
- `ComputedModule` - derived values (`computed(() => ...)`)
- `EffectModule` - synchronous side effects (`effect(() => ...)`)
- `BatchModule` - batched updates (`batch(() => ...)`)
- `SubscribeModule` - external subscriptions
- `UntrackModule` - untracked reads

Signal API: `sig()` reads, `sig(value)` writes, `sig.peek()` reads without tracking.

Effects are **synchronous** - they run immediately when dependencies change. This is intentional and differs from React's useEffect.

### View Primitives

View modules are factory functions that take an adapter:

```ts
const adapter = createDOMAdapter();
const svc = compose(
  SignalModule, ComputedModule, EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter)
);
```

Primitives:
- `el(tag).props({...})(...children)` - element specs
- `map(items, keyFn, render)` - reactive lists
- `match(reactive, matcher)` - conditional rendering
- `portal(target)(child)` - render to different DOM location

Specs are inert blueprints. Call `.create(svc)` or use `mount()` to instantiate.

### Behaviors

Behaviors are portable functions that receive a service and return an API:

```ts
const counter = (svc) => (initial = 0) => {
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
├── lattice/     # Core: compose, defineModule, merge
├── signals/     # Reactive primitives
├── view/        # UI primitives (el, map, match, portal, load)
├── router/      # Client-side routing
├── resource/    # Async data fetching
├── ssr/         # Server-side rendering
├── react/       # React bindings
├── docs/        # Documentation site
├── benchmarks/  # Performance benchmarks
└── examples/    # Example applications
```

### Import Conventions

- **Modules**: `import { SignalModule } from '@lattice/signals/extend'`
- **Types**: `import type { Readable, SignalFunction } from '@lattice/signals'`
- **View factories**: `import { createElModule } from '@lattice/view/el'`
- **Adapters**: `import { createDOMAdapter } from '@lattice/view/adapters/dom'`

The `/extend` path exports modules and factory functions for composition. The base path exports types.

## Type Export Guidelines

When exporting types, ensure all referenced types are also exported. TS2742 ("The inferred type cannot be named...") occurs when a public type references an unexported internal type.

**Solution**: Export all constituent types from the same entry point. Users should never need explicit return type annotations.

## Testing

Tests are co-located with source files (`*.test.ts`). Key test files:
- `api.test.ts` - integration tests
- `detached-memory.test.ts` - memory leak tests

## Git Workflow

Follow conventional commits: `fix:`, `feat:`, `docs:`, `chore:`, `test:`

Create changesets for releases: `pnpm changeset`

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
