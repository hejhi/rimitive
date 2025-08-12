# Lattice Monorepo Guide for Claude Code

## Critical Context

Lattice is a **composable extension system** for building reactive libraries. The monorepo contains:
- **Lattice Core**: Generic extension composition framework
- **Signals**: A state management library built with Lattice
- **React bindings**: For Lattice extensions and Signals
- **DevTools**: Works with ANY library built using Lattice

**Important Notes:**
- `reference-packages/` contains temporary code to reference - DO NOT MODIFY
- Always run `pnpm check` to run all essential type checking, linting, and tests before considering changes complete
- Performance regressions are blocking issues - verify with `pnpm bench`; benchmark JSON results are output into `packages/benchmarks/dist`, namespaced with `<commit-hash>-<timestamp>-<benchmark-name>`.

## Architecture Overview

```
@lattice/lattice (extension composition framework)
    ├── Used by → @lattice/signals (example: reactive state library)
    ├── Used by → [any other library built with lattice]
    └── Instrumented by → @lattice/devtools-extension

@lattice/react (React bindings)
    ├── Bindings for → @lattice/lattice extensions
    └── Bindings for → @lattice/signals specifically
```

## Package Responsibilities

### @lattice/lattice - Extension Composition Framework

**Purpose**: Generic framework for composing functionality via extensions
- Entry: `src/extension.ts` - Core extension system
- Key API: `createContext()` - Composes extensions into contexts
- Instrumentation: `src/instrumentation/` - Provider-based debugging/monitoring

**Example Usage**:
```typescript
// Any library can use Lattice to compose extensions
const api = createContext([
  myExtension1,
  myExtension2,
  customExtension
]);
```

### @lattice/signals - State Management Library

Signals is a state management library built with Lattice.

**Purpose**: High-performance, tree-shake-able reactive state management
- Entry: `src/api.ts` - Uses Lattice to compose signal primitives
- Core: `src/signal.ts`, `src/computed.ts`, `src/effect.ts`
- Algorithms: `src/helpers/` - Graph algorithms specific to signals
- Built with: `@lattice/lattice` for extension composition

### @lattice/react - React Bindings

**Two Responsibilities**:
1. **Lattice bindings**: `src/lattice/` - React hooks for ANY Lattice extension
2. **Signals bindings**: `src/signals/` - React hooks specifically for Signals

- Uses `useSyncExternalStore` for external state
- Maintains React 18+ compatibility
- Test: `pnpm --filter @lattice/react test`

### @lattice/devtools-extension - Universal DevTools

**Purpose**: Debug ANY library built with Lattice (not just Signals)
- Works via Lattice's instrumentation providers
- Connects through `withInstrumentation()` wrapper
- Visualizes any instrumented Lattice context

## Common Development Tasks

### Building a New Library with Lattice

1. Create package that depends on `@lattice/lattice`
2. Define extensions using `LatticeExtension` interface:
```typescript
const myExtension: LatticeExtension<'myMethod', () => void> = {
  name: 'myMethod',
  method: () => { /* implementation */ }
};
```
3. Compose extensions: `createContext([ext1, ext2])`
4. Add instrumentation support via `withInstrumentation()`
5. DevTools will automatically work with your library

### Adding Extensions to Lattice Core

1. Extensions go in consuming packages, NOT in Lattice core
2. Lattice provides the composition mechanism only
3. Add TypeScript types to ensure type safety
4. Test composition with multiple extensions

### Modifying Signals Library

**CRITICAL**: Signals has highly optimized algorithms. Before modifying:
1. Understand the graph algorithms in `src/helpers/`
2. Maintain O(1) complexity guarantees
3. Run benchmarks: `pnpm --filter @lattice/benchmarks bench`
4. Test: `pnpm --filter @lattice/signals test`

**Performance Critical Files**:
- `packages/signals/src/helpers/dependency-graph.ts`
- `packages/signals/src/helpers/graph-walker.ts`
- `packages/signals/src/helpers/work-queue.ts`

### Adding React Bindings

**For Lattice extensions**:
1. Add to `packages/react/src/lattice/`
2. Use `useLatticeContext()` for context access
3. Handle cleanup with `useEffect` return

**For Signals specifically**:
1. Add to `packages/react/src/signals/`
2. Use `useSubscribe()` pattern for reactivity
3. Test with `renderWithSignals()` helper

## Testing Requirements

### Before Any Commit
```bash
# Type checking, linting, and testing - MUST PASS
pnpm check

# For performance changes in signals
pnpm --filter @lattice/benchmarks bench

# For React changes
pnpm --filter @lattice/react test
```

### Test Organization
- Co-located tests with `.test.ts` suffix
- Each package has `src/test-setup.ts`
- Benchmarks in `packages/benchmarks/`

## Key Concepts

### Lattice Extension System

**Extension Interface**:
```typescript
interface LatticeExtension<TName, TMethod> {
  name: TName;
  method: TMethod;
  wrap?: (method, context) => TMethod;
  instrument?: (method, instrumentation) => TMethod;
  onCreate?: (context) => void;
  onDispose?: (context) => void;
}
```

**Composition Pattern**:
- Extensions are composable units of functionality
- Type-safe merging at compile time
- Automatic disposal and lifecycle management
- Instrumentation hooks for debugging

### Signals Architecture

**Reactive Graph**:
- Push-pull hybrid algorithm
- Intrusive linked lists for memory efficiency
- Version-based invalidation
- Generation-based cleanup

**Key Data Structures**:
- Signal: Producer nodes
- Computed: Lazy evaluation
- Effect: Side effect scheduling
- Edge: Bidirectional graph links

## Development Commands

```bash
# Development
pnpm dev                    # Watch all packages
pnpm build                  # Build all packages

# All checks
pnpm check                 # Runs all tests, type validation, and linting

# Testing
pnpm test                  # All tests
pnpm typecheck             # Type validation
pnpm bench                 # Benchmarks (signals)

# Package-specific
pnpm --filter @lattice/lattice check
pnpm --filter @lattice/signals check
pnpm --filter @lattice/react check

# Utilities
pnpm clean                 # Clean dist folders
pnpm lint                  # ESLint check
pnpm format               # Prettier format
```

## Build Configuration

### Package Structure
- Fine-grained exports for tree-shaking
- ES modules only (no CommonJS)
- TypeScript strict mode
- Vite for bundling

### Monorepo Setup
- pnpm workspaces for linking
- Lerna for orchestration
- Shared TypeScript config
- Vitest for testing

## Important Implementation Notes

### Lattice Core Philosophy
1. **Generic composition** - Not tied to any specific domain
2. **Extension-based** - All functionality via extensions
3. **Type-safe** - TypeScript ensures composition safety
4. **Instrumentable** - Built-in debugging support
5. **Tree-shakeable** - Import only what you need

### Signals Library Specifics
1. **Performance first** - O(1) operations critical
2. **Memory efficient** - Intrusive data structures
3. **Lazy evaluation** - Computed values on-demand
4. **Automatic cleanup** - Prevents memory leaks
5. **Batching support** - Transaction semantics

### DevTools Integration
1. **Provider-based** - Pluggable instrumentation
2. **Framework agnostic** - Works with any Lattice library
3. **Event streaming** - Real-time debugging
4. **Performance monitoring** - Built-in thresholds

## Common Gotchas

1. **Lattice vs Signals**: Lattice is the framework, Signals is built WITH it
2. **Extension conflicts**: Same-named extensions will conflict
3. **Memory leaks**: Always implement disposal in extensions
4. **Performance**: Signals requires O(1) guarantees
5. **DevTools**: Must wrap with `withInstrumentation()` to enable