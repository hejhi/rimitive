# Lattice Monorepo Guide for Claude Code

## Critical Context

Lattice is a high-performance reactive state management framework. Performance is the #1 priority - any changes must maintain O(1) complexity guarantees and avoid allocations.

**Important Notes:**
- `reference-packages/` contains temporary code to reference - DO NOT MODIFY
- Always run `pnpm typecheck` and `pnpm test` before considering changes complete
- Performance regressions are blocking issues - verify with `pnpm bench`

## Package Dependencies & Architecture

```
@lattice/signals (core)
    ↓
@lattice/lattice (extension layer)
    ↓
@lattice/react (framework adapter)
```

### Package Responsibilities

**@lattice/signals** - Core reactive engine
- Entry: `src/api.ts` - Factory functions that create the signal API
- Key files: `src/signal.ts`, `src/computed.ts`, `src/effect.ts`
- Helpers: `src/helpers/` - Graph algorithms (DO NOT modify without benchmarking)
- Test before changes: `pnpm --filter @lattice/signals test`

**@lattice/lattice** - Extension composition
- Entry: `src/index.ts` - Extension system for composing functionality
- Instrumentation: `src/instrumentation/` - DevTools and performance monitoring
- Test: `pnpm --filter @lattice/lattice test`

**@lattice/react** - React bindings
- Entry: `src/signals/hooks.ts` - React hooks for signals
- Context: `src/signals/context.tsx` - Provider pattern
- Uses `useSyncExternalStore` - maintain React 18+ compatibility
- Test: `pnpm --filter @lattice/react test`

## Common Development Tasks

### Adding a New Reactive Primitive

1. Create factory in `packages/signals/src/[primitive].ts`
2. Add to API in `packages/signals/src/api.ts`
3. Export from package.json exports field
4. Add tests in same directory with `.test.ts` suffix
5. Update vite.config.ts entry points
6. Run full test suite: `pnpm test`
7. Benchmark impact: `pnpm bench`

### Modifying Core Algorithms

**CRITICAL**: The helper algorithms in `packages/signals/src/helpers/` are highly optimized. Before modifying:
1. Understand the current algorithm completely
2. Write benchmarks for your changes
3. Verify O(1) complexity is maintained
4. Check memory allocation patterns
5. Run `pnpm bench` before and after

### Debugging Reactive Graphs

1. Use the devtools extension in `packages/devtools-extension/`
2. Enable instrumentation: wrap context with `withInstrumentation()`
3. Key debugging points:
   - `src/helpers/graph-walker.ts:35` - Graph traversal
   - `src/helpers/dependency-graph.ts:108` - Edge creation
   - `src/computed.ts:158` - Recomputation logic

### Adding React Integration Features

1. Add hooks to `packages/react/src/signals/hooks.ts`
2. Maintain `useSyncExternalStore` pattern for subscriptions
3. Test with `renderWithSignals()` helper
4. Verify no memory leaks with cleanup tests

## Performance Critical Sections

**DO NOT MODIFY** without extensive benchmarking:
- `packages/signals/src/helpers/dependency-graph.ts` - Edge management
- `packages/signals/src/helpers/graph-walker.ts` - DFS traversal
- `packages/signals/src/helpers/work-queue.ts` - Scheduling queue
- `packages/signals/src/constants.ts` - Bit flag definitions

**Optimization Patterns to Maintain:**
- Intrusive linked lists (edges ARE nodes)
- Edge caching via `_lastEdge`
- Version-based invalidation
- Bit flags for state
- No allocations in hot paths

## Testing Requirements

### Before Any Commit
```bash
# Type checking - MUST PASS
pnpm typecheck

# Unit tests - MUST PASS
pnpm test

# For performance-sensitive changes
pnpm bench

# For React changes specifically
pnpm --filter @lattice/react test
```

### Test Patterns
- Tests use `resetGlobalState()` for isolation
- Each package has `src/test-setup.ts` for configuration
- Benchmarks in `packages/benchmarks/src/suites/lattice/`
- Use `.test.ts` suffix for test files

## Anti-Patterns to Avoid

1. **Never use arrays for dependency tracking** - Use intrusive linked lists
2. **Never allocate in hot paths** - Reuse objects via pooling
3. **Never use Map/Set for small collections** - Use linked lists or arrays
4. **Never break version guarantees** - Computed values must be consistent
5. **Never mutate signals directly** - Always use `.value` setter
6. **Never create circular dependencies** - Will cause infinite loops
7. **Never skip cleanup** - Memory leaks are critical bugs

## Key Implementation Files

### Core Reactive System
- `packages/signals/src/signal.ts:77` - Signal class implementation
- `packages/signals/src/computed.ts:83` - Computed with lazy evaluation
- `packages/signals/src/effect.ts:94` - Effect scheduling
- `packages/signals/src/batch.ts:72` - Batch transaction logic

### Graph Algorithms
- `packages/signals/src/helpers/dependency-graph.ts:108` - Edge management
- `packages/signals/src/helpers/graph-walker.ts:35` - DFS traversal
- `packages/signals/src/helpers/dependency-sweeper.ts:54` - GC algorithm
- `packages/signals/src/helpers/propagator.ts:57` - Update propagation

### React Integration
- `packages/react/src/signals/hooks.ts` - All React hooks
- `packages/react/src/signals/context.tsx` - Provider setup
- `packages/react/src/test-setup.ts` - Test utilities

## Build Configuration

### Package Exports
Each package uses fine-grained exports for tree-shaking:
```json
"exports": {
  "./signal": "./dist/signal.js",
  "./computed": "./dist/computed.js"
}
```

### TypeScript Settings
- Strict mode enabled - maintain type safety
- `noUncheckedIndexedAccess` - array access safety
- ES2022 target - use modern features

### Vite Configuration
- Custom Terser plugin mangles `_` prefixed properties
- Multiple entry points for granular imports
- ES modules only - no CommonJS

## Development Commands

```bash
# Development
pnpm dev                    # Watch all packages
pnpm build                  # Build all packages
pnpm --filter @lattice/signals dev  # Watch specific package

# Testing
pnpm test                   # All tests
pnpm typecheck             # Type validation
pnpm bench                 # Performance benchmarks
pnpm bench:compare         # Compare with previous results

# Package-specific
pnpm --filter @lattice/signals test
pnpm --filter @lattice/react test
pnpm --filter @lattice/benchmarks bench

# Utilities
pnpm clean                 # Clean dist folders
pnpm lint                  # ESLint check
pnpm format               # Prettier format
```

## Architecture Decisions & Rationale

1. **Intrusive data structures**: Edges are list nodes to avoid allocation
2. **Version counters**: O(1) staleness detection without graph traversal
3. **Push-pull hybrid**: Eager invalidation, lazy computation
4. **Generation-based cleanup**: Handles dynamic dependencies automatically
5. **Bit flags**: Pack multiple states in single integer
6. **Factory pattern**: Enables tree-shaking and composition
7. **Fine-grained exports**: Import only what you need

## Common Gotchas

1. **Edge cleanup**: Always bidirectional unlink to prevent leaks
2. **Version overflow**: Handle version counter wraparound
3. **Batch nesting**: Effects run after outermost batch
4. **Circular dependencies**: RUNNING flag prevents but doesn't fix
5. **Memory leaks**: Disposed nodes must clear all references
6. **React StrictMode**: Effects may run twice - ensure idempotent