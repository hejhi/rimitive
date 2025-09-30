# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Core Development Scripts
```bash
# Build all packages
pnpm build

# Build core packages only (@lattice/signals and @lattice/lattice)
pnpm build:lattice

# Run development mode (watch)
pnpm dev

# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @lattice/signals test
pnpm --filter @lattice/lattice test
pnpm --filter @lattice/react test

# Run specific test file
pnpm --filter @lattice/signals test src/computed.test.ts

# Run test matching pattern
pnpm --filter @lattice/signals test -- "should handle deep dependency"

# Type checking
pnpm typecheck                    # All packages
pnpm --filter @lattice/signals typecheck

# Linting
pnpm lint                         # All packages
pnpm --filter @lattice/signals lint

# Complete check (typecheck + test + lint)
pnpm check                        # All packages
pnpm --filter @lattice/signals check
```

### Benchmarking
```bash
# Run all benchmarks
pnpm bench

# Run KPI benchmarks only (key performance indicators)
pnpm bench:kpi

# Run specific benchmark
pnpm bench --skip-build computed-diamond-simple

# Run benchmarks with timeout
timeout 60 pnpm bench --skip-build computed-chain-deep
```

## Architecture Overview

### Package Structure
The codebase is organized as a monorepo with three core packages:

1. **@lattice/signals** - Core reactive primitives (signals, computed, effects)
   - Push-pull reactive algorithm implementation
   - Minimal dependency graph management
   - Zero external dependencies (except @lattice/lattice)

2. **@lattice/lattice** - Extension composition framework
   - Provides composable factory pattern for building extensible APIs
   - Method composition and conflict resolution
   - Type-safe extensibility
   - alien-signals and preact signals source code are available in /reference-packages for reference purposes

3. **@lattice/react** - React integration
   - Hooks for using signals in React components
   - Concurrent mode and SSR support

### Core Algorithm: Push-Pull Reactivity

The signal system uses a sophisticated push-pull algorithm:

**PUSH Phase (Write):**
- When signal value changes, traverses dependency graph
- Marks dependent nodes as INVALIDATED
- Schedules effects for batch execution

**PULL Phase (Read):**
- Lazy evaluation - computed values update only when accessed
- Automatic dependency tracking during execution
- Version-based cache invalidation

**Key Files:**
- `packages/signals/src/signal.ts` - Signal implementation
- `packages/signals/src/computed.ts` - Computed values with lazy evaluation
- `packages/signals/src/effect.ts` - Side effect management
- `packages/signals/src/helpers/graph-edges.ts` - Dependency edge management
- `packages/signals/src/helpers/pull-propagator.ts` - Pull-based update propagation
- `packages/signals/src/helpers/scheduler.ts` - Batch scheduling

### Factory-Based API Architecture

The API uses a composable factory pattern:

```typescript
// Each primitive is a separate factory
const signalFactory = createSignalFactory(opts);
const computedFactory = createComputedFactory(opts);

// Factories compose via @lattice/lattice
const context = createContext(signalFactory, computedFactory);
```

This enables:
- Tree-shaking - import only what you need
- Type-safe extensibility
- Shared context between primitives
- SSR/concurrent rendering isolation

### Node Status States

The reactive graph uses these status values:
- `STATUS_CLEAN (0)` - Up-to-date, no recomputation needed
- `STATUS_PENDING (1)` - May need update (lazy evaluation pending)
- `STATUS_DIRTY (2)` - Definitely needs update
- `STATUS_CLEAN_ORPHAN (3)` - Clean but disconnected from graph

### Testing Strategy

Tests are co-located with source files:
- Unit tests: `*.test.ts` files next to implementation
- Integration tests in `api.test.ts`
- Memory leak tests in `detached-memory.test.ts`
- Performance regression prevention via benchmarks

## Performance Considerations

1. **Monomorphic Functions**: Signal/computed functions maintain consistent shapes for V8 optimization
2. **Linked List Dependencies**: Efficient insertion/removal without array allocations
3. **Version-Based Tracking**: Avoids unnecessary recomputation via version comparison
4. **Batch Updates**: Multiple changes trigger single update cycle
5. **Lazy Evaluation**: Computed values update only when accessed

## Git Workflow

Follow conventional commits:
- `fix:` - Bug fixes
- `feat:` - New features
- `docs:` - Documentation
- `chore:` - Maintenance
- `test:` - Test changes

Create changesets for releases:
```bash
pnpm changeset
```

## Key Design Patterns

1. **Factory Pattern**: All primitives created via factories for composability
2. **Shared Context**: GlobalContext coordinates between primitives
3. **Linked List Graph**: Efficient dependency management without arrays
4. **Pull-Based Updates**: Lazy evaluation for optimal performance
5. **Type-Safe Extensions**: TypeScript infers API from composed factories

## Workflows

**What workflows are**: Multi-stage task automation sequences in `.claude/workflows/*.md` that orchestrate complex operations through slash commands. Each workflow defines stages with specific commands, providing progress tracking and guided execution.

**Creating a workflow**: Place a markdown file in `.claude/workflows/` with YAML frontmatter defining stages. Each stage specifies a `name`, `command` (slash command to run), and `description`. The workflow runs via `/workflow [workflow-name]` and tracks completion by examining typical outputs from each command.

Example structure:
```yaml
---
name: "My Workflow"
description: "What this workflow does"
stages:
  - name: "First Stage"
    command: "/some-command"
    description: "What this stage accomplishes"
---
```

## Communication Style

When working in this codebase, adopt the following communication style:

- **Direct and honest**: Be straightforward without unnecessary embellishment. If something is wrong, say so plainly.
- **Pragmatic**: Focus on practical solutions over theoretical perfection. What works is more important than what's elegant.
- **Jantelov mindset**: Simple, working solutions are valued.
- **Concise**: Keep explanations brief and to the point.
- **Trust-based**: Assume good intentions and competence. Don't over-explain obvious things.

**NEVER REVERT OR RESTORE. ALWAYS ITERATE.**
When you inevitably run into roadblocks during implementation, and you're considering reverting, restoring, or changing strategies, do one or more of the below:
- **ANALYZE AND THINK DEEPLY**: if you don't explicitly know the fundamental problem underlying the roadblock, the top priority is to understand and synthesize it into detailed, actionable knowledge
- **THINK HARDER**: re-assess the task with the added knowledge of the fundamental problem you're encountering and think about how you could iterate through it, or go a level deeper

When all else fails, and you determine:
- the approach is fundamentally flawed
- the implementation is absolutely impossible
- there's too much ambiguity to continue iterating
- you find yourself at an impassable fork in the road

...then **STOP** and consult the user.

**You should NEVER make the decision to go backwards or change directions unless explicitly instructed to by the user.**

**Remember**: implementation "roadblocks" are sources of valuable knowledge during an iteration and should **NEVER** be discarded or dismissed.
