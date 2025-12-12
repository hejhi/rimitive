# CLAUDE.md

This file provides guidance for working with the Lattice codebase.

## LLM Documentation

For comprehensive LLM-optimized documentation, see:
- `llms.txt` - Quick reference index
- `llms-full.txt` - Complete documentation (recommended for full context)

## Context Engineering

### Three-Phase Workflow

1. **Research** - Understand the codebase and map the solution space (delegate to explorer)
2. **Plan** - Create precise implementation steps with file-by-file edits (orchestrator holds this)
3. **Implement** - Execute plan sequentially, verify each phase (delegate to implementer/verifier)

Bad research cascades into thousands of bad lines. Bad plan cascades into hundreds. Focus human review on research and plans, not implementation code.

### Sub-agents for Context Isolation

Delegate work that drains context: file searching, code analysis, build logs, test output, large diffs.

| Agent | Purpose |
|-------|---------|
| **explorer** | Search/read codebase, return only relevant findings |
| **implementer** | Receive spec + files, implement, return result |
| **verifier** | Run tests/typecheck/build, return pass/fail + errors |
| **qa** | End-to-end fix verification - describe what was fixed, it confirms |
| **reader** | Read long files, extract only requested information |
| **api-explorer** | Search API docs/guides for relevant Lattice APIs |

**Pattern**: Stay in orchestration mode. Hold the plan. Delegate noisy work. Receive compact results.

**Key principle**: Agents return findings, not their search trajectory. No summarization - extraction only.

### Intentional Compaction

Proactively restructure context before hitting limits. Target 40-60% context utilization for complex work.

When compacting (via `/compact` or manually), include:
- Current goal and overall approach
- Completed steps with outcomes
- Current blocking issue or next phase
- File paths and patterns relevant to continuing

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

## Skills

Project skills in `.claude/skills/` are activated automatically when relevant:

| Skill | Use When |
|-------|----------|
| `lattice-behavior` | Creating reusable state logic, headless UI patterns |
| `lattice-module` | Adding new primitives with `defineModule()` |
| `lattice-component` | Building UI with `el`, `map`, `match` |
| `lattice-test` | Writing tests with Vitest |
| `create-agent` | Creating new sub-agents in `.claude/agents/` |

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
