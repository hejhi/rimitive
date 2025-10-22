# Phase 3: Integrate Signals Effect

**Duration:** 2-3 days

## Goal
Replace view's custom effect implementation with signals' real effect system, enabling automatic dependency tracking and proper reactive scheduling for view components.

## Background
Currently, view uses a simple custom effect in `test-utils.ts`:
```typescript
const effect = (fn: () => void) => {
  const cleanup = () => { signalMap.forEach(subscribers => subscribers.delete(fn)); };
  signalMap.forEach(subscribers => subscribers.add(fn));
  fn();
  return cleanup;
};
```

This is limited:
- Manual subscription management
- No automatic batching
- No dependency tracking
- No integration with scheduler

By using signals' real `effect()` with `RenderScope`, we get all these features for free.

## Implementation Details

### 1. Update Scope Creation to Use Signals

Location: `packages/view/src/helpers/scope.ts`

```typescript
import type { LatticeContext } from '@lattice/lattice/context';
import type { RenderScope, Disposable } from '../types';
import { CONSTANTS } from '@lattice/signals/constants';
import type { GraphEdges } from '@lattice/signals/helpers/graph-edges';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';

const { CONSUMER, SCHEDULED, CLEAN } = CONSTANTS;

export interface ScopeOpts {
  ctx: LatticeContext;
  graphEdges: GraphEdges;
  scheduler: Scheduler;
}

export function createScopes(opts: ScopeOpts) {
  const { ctx, graphEdges, scheduler } = opts;

  /**
   * Create a new RenderScope with automatic reactive tracking
   *
   * The scope is a ScheduledNode that:
   * - Tracks dependencies via signals' graph-edges
   * - Schedules updates via signals' scheduler
   * - Manages disposal via tree structure
   */
  const createScope = (
    renderFn?: () => void | (() => void),
    parent?: RenderScope
  ): RenderScope => {
    const scope: RenderScope = {
      __type: 'render-scope',
      status: CONSUMER | SCHEDULED | CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
      nextScheduled: undefined,
      parent,
      firstChild: undefined,
      nextSibling: undefined,
      firstDisposable: undefined,
      cleanup: undefined,

      // flush() is called by scheduler when dependencies change
      flush(): void {
        // Run previous cleanup
        if (scope.cleanup) {
          const cleanupFn = scope.cleanup;
          scope.cleanup = undefined;
          if (typeof cleanupFn === 'function') cleanupFn();
        }

        // Re-run render function with dependency tracking
        if (renderFn) {
          scope.cleanup = graphEdges.track(scope, renderFn);
        }
      },
    };

    // Attach to parent's child list
    if (parent) {
      scope.nextSibling = parent.firstChild;
      parent.firstChild = scope;
    }

    // Initial render if render function provided
    if (renderFn) {
      scope.flush();
    }

    return scope;
  };

  /**
   * Run function within scope context
   * Sets ctx.activeScope so both signals and view can track
   */
  const runInScope = <T>(scope: RenderScope, fn: () => T): T => {
    const prevScope = ctx.activeScope;
    ctx.activeScope = scope;
    try {
      return fn();
    } finally {
      ctx.activeScope = prevScope;
    }
  };

  /**
   * Track a disposable in the current scope
   * For non-reactive disposables (event listeners, etc.)
   */
  const trackInScope = (disposable: Disposable): void => {
    const scope = ctx.activeScope;
    if (scope) {
      trackInSpecificScope(scope, disposable);
    }
  };

  /**
   * Track a disposable in a specific scope
   */
  const trackInSpecificScope = (scope: RenderScope, disposable: Disposable): void => {
    if ((scope.status & CONSTANTS.DISPOSED) === 0) {
      const node: DisposableNode = {
        disposable,
        next: scope.firstDisposable,
      };
      scope.firstDisposable = node;
    }
  };

  /**
   * Dispose scope and all children
   * Uses signals' scheduler for reactive cleanup
   */
  const disposeScope = (scope: RenderScope): void => {
    if ((scope.status & CONSTANTS.DISPOSED) !== 0) return;

    // 1. Use scheduler to dispose reactive parts
    // This handles: status update, cleanup function, dependency detachment
    scheduler.dispose(scope, (node) => {
      if (node.cleanup) {
        const cleanupFn = node.cleanup;
        node.cleanup = undefined;
        if (typeof cleanupFn === 'function') cleanupFn();
      }
    });

    // 2. Dispose all child scopes recursively
    let child = scope.firstChild;
    while (child) {
      const next = child.nextSibling;
      disposeScope(child);
      child = next;
    }

    // 3. Dispose tracked disposables (event listeners, etc.)
    let disposableNode = scope.firstDisposable;
    while (disposableNode) {
      const disposable = disposableNode.disposable;
      if (disposable && typeof disposable.dispose === 'function') {
        disposable.dispose();
      }
      disposableNode = disposableNode.next;
    }

    // Clear references
    scope.firstChild = undefined;
    scope.firstDisposable = undefined;
  };

  return {
    createScope,
    runInScope,
    trackInScope,
    trackInSpecificScope,
    disposeScope,
  };
}
```

### 2. Update el() Factory

Location: `packages/view/src/el.ts`

```typescript
// Update ElOpts to include signals dependencies
export type ElOpts<
  TElement extends RendererElement = RendererElement,
  TText extends TextNode = TextNode,
> = {
  ctx: LatticeContext;
  graphEdges: GraphEdges;      // NEW: For dependency tracking
  scheduler: Scheduler;         // NEW: For scheduling
  createScope: CreateScopes['createScope'];
  runInScope: CreateScopes['runInScope'];
  trackInScope: CreateScopes['trackInScope'];
  trackInSpecificScope: CreateScopes['trackInSpecificScope'];
  effect: (fn: () => void | (() => void)) => () => void;  // DEPRECATED: Remove later
  renderer: Renderer<TElement, TText>;
  processChildren: (parent: TElement, children: ElRefSpecChild<TElement>[]) => void;
};

// In el() implementation - no changes needed!
// The scope creation and reactive tracking happens automatically
// because createScope now uses signals' graph-edges.track()
```

### 3. Update map() and match() Factories

Similar updates to `ElOpts` - add `graphEdges` and `scheduler` dependencies.

The key change is in how effects are created. Instead of:

```typescript
// Before (custom effect)
const dispose = effect(() => {
  const value = reactive();
  // ... render logic ...
});
```

We now use:

```typescript
// After (signals effect via scope)
const renderScope = createScope(() => {
  const value = reactive();
  // ... render logic ...
}, parentScope);

// Cleanup is handled by disposeScope(renderScope)
```

### 4. Update Test Utils

Location: `packages/view/src/test-utils.ts`

```typescript
/**
 * Creates a complete test environment with real signals integration
 */
export function createTestEnv() {
  const ctx = createLatticeContext();
  const { renderer } = createMockRenderer();

  // Create signals infrastructure
  const graphEdges = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const _scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const { withPropagate, ...scheduler } = _scheduler;
  const propagate = withPropagate(withVisitor);

  // Create real signal and effect using signals API
  const signalFactory = createSignalFactory({ ctx, propagate, ...graphEdges });
  const effectFactory = createEffectFactory({ ctx, ...graphEdges, ...scheduler });

  const signal = signalFactory.method;
  const effect = effectFactory.method;

  // Create scope helpers with full signals integration
  const scopeHelpers = createScopes({ ctx, graphEdges, scheduler });
  const { trackInScope } = scopeHelpers;

  // Create processChildren helper
  const { processChildren, handleChild } = createProcessChildren({
    trackInScope,
    effect, // Real signals effect!
    renderer,
  });

  return {
    ctx,
    renderer,
    signal,
    effect,
    handleChild,
    processChildren,
    ...scopeHelpers,
  };
}
```

### 5. Remove Custom Effect Implementation

Delete the old custom effect from `test-utils.ts`:

```typescript
// DELETE THIS:
const signalMap = new Map<Reactive<unknown>, Set<() => void>>();

const effect = (fn: () => void) => {
  const cleanup = () => {
    signalMap.forEach(subscribers => subscribers.delete(fn));
  };
  signalMap.forEach(subscribers => subscribers.add(fn));
  fn();
  return cleanup;
};
```

## Migration Strategy

1. **Day 1**: Update `createScopes()` to accept signals dependencies
2. **Day 1**: Implement new `createScope()` using `graphEdges.track()`
3. **Day 2**: Update factory `Opts` types to include signals deps
4. **Day 2**: Update `test-utils.ts` to use real signals
5. **Day 3**: Run full test suite and fix any issues
6. **Day 3**: Remove deprecated custom effect code

## Testing Strategy

1. **Unit tests**: All existing view tests should pass
2. **Integration tests**: Test that signals actually trigger view updates
3. **Reactivity tests**: Verify automatic dependency tracking works
4. **Disposal tests**: Verify scheduler.dispose() cleans up properly
5. **Performance tests**: Benchmark to ensure no regressions

### New Test Cases

```typescript
it('should automatically track signal dependencies', () => {
  const { signal, createScope, ctx } = createTestEnv();
  const count = signal(0);
  let renders = 0;

  const scope = createScope(() => {
    count(); // Read signal
    renders++;
  });

  expect(renders).toBe(1); // Initial render

  count(1); // Update signal
  // Scheduler should auto-flush and re-run scope.flush()
  expect(renders).toBe(2); // Auto re-render!

  disposeScope(scope);
});

it('should batch multiple signal updates', () => {
  const { signal, createScope, scheduler } = createTestEnv();
  const a = signal(0);
  const b = signal(0);
  let renders = 0;

  const scope = createScope(() => {
    a();
    b();
    renders++;
  });

  expect(renders).toBe(1);

  scheduler.startBatch();
  a(1);
  b(2);
  scheduler.endBatch(); // Single flush

  expect(renders).toBe(2); // Only one re-render!
});
```

## Success Criteria

- [ ] `createScope()` uses `graphEdges.track()` for dependency tracking
- [ ] `disposeScope()` uses `scheduler.dispose()` for cleanup
- [ ] Custom effect implementation removed from `test-utils.ts`
- [ ] All existing view tests pass
- [ ] New reactivity tests pass
- [ ] Performance benchmarks show no regression
- [ ] Components automatically re-render when dependencies change

## Benefits

- **Automatic reactivity**: No manual subscription management
- **Free batching**: Multiple signal updates = one render
- **Proper disposal**: Scheduler handles dependency cleanup
- **Less code**: ~50 lines removed from test-utils
- **Better DX**: Components "just work" with signals

## Risks & Mitigations

**Risk**: Introducing signals as runtime dependency
- **Mitigation**: Signals is already a peer dependency, just making it explicit

**Risk**: Performance regression from scheduler overhead
- **Mitigation**: Benchmark before/after, scheduler is highly optimized

**Risk**: Breaking changes to existing code
- **Mitigation**: Maintain backward compat, deprecate gradually

## Related Files

- `packages/view/src/helpers/scope.ts` - Main changes
- `packages/view/src/test-utils.ts` - Remove custom effect
- `packages/view/src/el.ts` - Update factory opts
- `packages/view/src/map.ts` - Update factory opts
- `packages/view/src/match.ts` - Update factory opts
