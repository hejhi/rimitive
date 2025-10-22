# Phase 5: Unified Disposal

**Duration:** 1 day

## Goal
Layer view's disposal logic over signals' scheduler disposal to create a unified cleanup system that properly handles both reactive graph cleanup and UI tree disposal.

## Background
Currently, view and signals have separate disposal implementations:
- **View**: `disposeScope()` walks tree, cleans up disposables
- **Signals**: `scheduler.dispose()` detaches dependencies, marks disposed

These should be composed: signals handles graph cleanup, view handles tree traversal.

## Implementation Details

### 1. Update disposeScope Implementation

Location: `packages/view/src/helpers/scope.ts`

**Before (current):**
```typescript
const disposeScope = (scope: Scope): void => {
  if (scope.status === DISPOSED) return;
  scope.status = DISPOSED;

  // Dispose children
  let child = scope.firstChild;
  while (child) { /* ... */ }

  // Dispose tracked items
  let node = scope.firstDisposable;
  while (node) { /* ... */ }

  // Clear references
  scope.firstChild = undefined;
  scope.firstDisposable = undefined;
};
```

**After (unified):**
```typescript
import { CONSTANTS } from '@lattice/signals/constants';

const { DISPOSED } = CONSTANTS;

const disposeScope = (scope: RenderScope): void => {
  // Check if already disposed using signals' status bits
  if ((scope.status & DISPOSED) !== 0) return;

  // ============ LAYER 1: Reactive Graph Disposal (signals) ============
  // This handles:
  // - Setting DISPOSED status bit
  // - Running cleanup function from last render
  // - Detaching all dependencies from the graph
  // - Clearing dependency pointers
  scheduler.dispose(scope, (node) => {
    if (node.cleanup) {
      const cleanupFn = node.cleanup;
      node.cleanup = undefined;
      if (typeof cleanupFn === 'function') {
        try {
          cleanupFn();
        } catch (e) {
          console.error('[Disposal] Error in cleanup function:', e);
        }
      }
    }
  });

  // ============ LAYER 2: UI Tree Disposal (view) ============
  // Recursively dispose all child scopes
  let child = scope.firstChild;
  while (child) {
    const next = child.nextSibling;
    disposeScope(child); // Recursive - each child goes through full disposal
    child = next;
  }

  // ============ LAYER 3: Additional Disposables (view) ============
  // Dispose non-reactive tracked items (event listeners, subscriptions, etc.)
  let disposableNode = scope.firstDisposable;
  while (disposableNode) {
    const disposable = disposableNode.disposable;
    if (disposable && typeof disposable.dispose === 'function') {
      try {
        disposable.dispose();
      } catch (e) {
        console.error('[Disposal] Error disposing tracked item:', e);
      }
    }
    disposableNode = disposableNode.next;
  }

  // ============ LAYER 4: Reference Cleanup (view) ============
  // Clear references to allow garbage collection
  scope.firstChild = undefined;
  scope.firstDisposable = undefined;
  scope.parent = undefined;
  scope.nextSibling = undefined;
  scope.element = undefined;

  // Note: dependencies/dependencyTail already cleared by scheduler.dispose
};
```

### 2. Add Disposal Safety Checks

```typescript
/**
 * Check if a scope is disposed
 * Uses signals' status bits for consistency
 */
export function isScopeDisposed(scope: RenderScope): boolean {
  return (scope.status & DISPOSED) !== 0;
}

/**
 * Safely access scope, returning null if disposed
 */
export function getScopeIfActive(scope: RenderScope | null | undefined): RenderScope | null {
  if (!scope) return null;
  if (isScopeDisposed(scope)) return null;
  return scope;
}
```

### 3. Update Element Disposal

Location: `packages/view/src/helpers/scope.ts` or new `dispose.ts`

```typescript
/**
 * Dispose element and its managing scope
 * Called when element is removed from DOM
 *
 * @param element - The element being removed
 * @param ctx - Lattice context with elementScopes map
 */
export function disposeElement<TElement extends object>(
  element: TElement,
  ctx: LatticeContext
): void {
  const scope = ctx.elementScopes.get(element);
  if (!scope) return;

  // Dispose the scope (includes reactive + tree + disposables)
  disposeScope(scope);

  // Remove from element map
  ctx.elementScopes.delete(element);
}
```

### 4. Add Disposal Hooks

Allow users to register disposal callbacks:

```typescript
/**
 * Register a callback to run when scope is disposed
 * Useful for cleanup that doesn't fit disposable pattern
 */
export function onScopeDispose(
  scope: RenderScope,
  callback: () => void
): void {
  trackInSpecificScope(scope, {
    dispose: callback,
  });
}

/**
 * Register a callback to run when element is removed
 */
export function onElementDispose<TElement extends object>(
  element: TElement,
  callback: () => void,
  ctx: LatticeContext
): void {
  const scope = ctx.elementScopes.get(element);
  if (scope) {
    onScopeDispose(scope, callback);
  }
}
```

### 5. Update Map/Match Disposal

**In map.ts reconciliation:**
```typescript
// When removing old items
if (oldItem) {
  const oldElement = oldItem.element;
  const oldScope = ctx.elementScopes.get(oldElement);
  if (oldScope) {
    disposeScope(oldScope);  // Uses unified disposal
    ctx.elementScopes.delete(oldElement);
  }
  renderer.removeChild(parent, oldElement);
}
```

**In match.ts:**
```typescript
// When switching branches
if (state.firstChild) {
  const oldElement = (state.firstChild as ElementRef<TElement>).element;
  const oldScope = ctx.elementScopes.get(oldElement);
  if (oldScope) {
    disposeScope(oldScope);  // Uses unified disposal
    ctx.elementScopes.delete(oldElement);
  }
  renderer.removeChild(parent, oldElement);
  state.firstChild = undefined;
  state.lastChild = undefined;
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('unified disposal', () => {
  it('should dispose reactive dependencies', () => {
    const { signal, createScope, graphEdges } = createTestEnv();
    const count = signal(0);
    let renders = 0;

    const scope = createScope(() => {
      count();
      renders++;
    });

    count(1);
    expect(renders).toBe(2);

    disposeScope(scope);

    count(2);
    expect(renders).toBe(2); // No more renders after disposal

    // Verify dependencies are detached
    expect(scope.dependencies).toBeUndefined();
  });

  it('should dispose child scopes recursively', () => {
    const { createScope } = createTestEnv();
    const disposed: string[] = [];

    const parent = createScope();
    const child1 = createScope(undefined, parent);
    const child2 = createScope(undefined, parent);
    const grandchild = createScope(undefined, child1);

    onScopeDispose(parent, () => disposed.push('parent'));
    onScopeDispose(child1, () => disposed.push('child1'));
    onScopeDispose(child2, () => disposed.push('child2'));
    onScopeDispose(grandchild, () => disposed.push('grandchild'));

    disposeScope(parent);

    expect(disposed).toEqual(['parent', 'grandchild', 'child1', 'child2']);
    expect(isScopeDisposed(parent)).toBe(true);
    expect(isScopeDisposed(child1)).toBe(true);
    expect(isScopeDisposed(child2)).toBe(true);
    expect(isScopeDisposed(grandchild)).toBe(true);
  });

  it('should dispose tracked disposables', () => {
    const { createScope, trackInScope } = createTestEnv();
    let disposed = false;

    const scope = createScope();
    runInScope(scope, () => {
      trackInScope({
        dispose: () => { disposed = true; }
      });
    });

    expect(disposed).toBe(false);
    disposeScope(scope);
    expect(disposed).toBe(true);
  });

  it('should run cleanup function', () => {
    const { createScope } = createTestEnv();
    let cleaned = false;

    const scope = createScope(() => {
      return () => { cleaned = true; };
    });

    expect(cleaned).toBe(false);
    disposeScope(scope);
    expect(cleaned).toBe(true);
  });

  it('should be idempotent', () => {
    const { createScope } = createTestEnv();
    let disposeCount = 0;

    const scope = createScope(() => {
      return () => { disposeCount++; };
    });

    disposeScope(scope);
    expect(disposeCount).toBe(1);

    disposeScope(scope); // Second call
    expect(disposeCount).toBe(1); // Still 1, not 2

    disposeScope(scope); // Third call
    expect(disposeCount).toBe(1); // Still 1
  });

  it('should handle errors in cleanup', () => {
    const { createScope } = createTestEnv();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let secondCleaned = false;

    const scope = createScope(() => {
      return () => {
        throw new Error('Cleanup error');
      };
    });

    onScopeDispose(scope, () => {
      secondCleaned = true;
    });

    expect(() => disposeScope(scope)).not.toThrow(); // Errors are caught
    expect(consoleError).toHaveBeenCalled();
    expect(secondCleaned).toBe(true); // Other disposables still run

    consoleError.mockRestore();
  });
});
```

### Integration Tests

```typescript
describe('disposal integration', () => {
  it('should dispose element and scope together', () => {
    const { ctx, renderer, createScope } = createTestEnv();
    const element = renderer.createElement('div');
    let disposed = false;

    const scope = createScope(() => {
      return () => { disposed = true; };
    });

    ctx.elementScopes.set(element, scope);

    disposeElement(element, ctx);

    expect(disposed).toBe(true);
    expect(ctx.elementScopes.has(element)).toBe(false);
    expect(isScopeDisposed(scope)).toBe(true);
  });

  it('should dispose map items correctly', () => {
    // Test that map reconciliation properly disposes old items
    const { signal, map, ctx } = createTestEnv();
    const items = signal([{ id: 1 }, { id: 2 }]);
    const disposedIds: number[] = [];

    map(items, (item) => {
      const itemRef = el(['div']);
      itemRef((element) => {
        onElementDispose(element, () => {
          disposedIds.push(item().id);
        }, ctx);
      });
      return itemRef;
    });

    items([{ id: 2 }, { id: 3 }]); // Remove id:1, add id:3
    expect(disposedIds).toContain(1);
    expect(disposedIds).not.toContain(2);
    expect(disposedIds).not.toContain(3);
  });
});
```

### Memory Leak Tests

```typescript
describe('disposal memory', () => {
  it('should not leak memory after disposal', () => {
    const { signal, createScope } = createTestEnv();
    const count = signal(0);
    const weakRefs: WeakRef<RenderScope>[] = [];

    // Create and dispose many scopes
    for (let i = 0; i < 1000; i++) {
      const scope = createScope(() => count());
      weakRefs.push(new WeakRef(scope));
      disposeScope(scope);
    }

    // Force garbage collection (if available)
    if (global.gc) global.gc();

    // Wait for GC
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that most scopes were garbage collected
    const alive = weakRefs.filter(ref => ref.deref() !== undefined).length;
    expect(alive).toBeLessThan(100); // Most should be collected
  });
});
```

## Documentation

### 6. Add JSDoc Examples

```typescript
/**
 * Dispose a render scope and all its resources
 *
 * Disposal happens in layers:
 * 1. Reactive graph cleanup (signals)
 * 2. UI tree disposal (recursive children)
 * 3. Additional disposables (event listeners, etc.)
 * 4. Reference cleanup (for GC)
 *
 * @example
 * ```typescript
 * const scope = createScope(() => {
 *   const count = signal(0);
 *   return () => console.log('cleanup');
 * });
 *
 * // Later...
 * disposeScope(scope); // Runs cleanup, detaches deps, clears refs
 * ```
 *
 * @param scope - The scope to dispose
 */
export function disposeScope(scope: RenderScope): void { /* ... */ }
```

## Success Criteria

- [ ] `disposeScope()` calls `scheduler.dispose()` for reactive cleanup
- [ ] Tree traversal properly disposes all children
- [ ] Tracked disposables are cleaned up
- [ ] References are cleared for GC
- [ ] Idempotent (safe to call multiple times)
- [ ] Error handling (one disposal error doesn't block others)
- [ ] All existing tests pass
- [ ] New disposal tests pass
- [ ] Memory leak tests pass

## Benefits

- **No duplication**: Each layer owns its concerns
  - Signals: reactive graph
  - View: UI tree + disposables
- **Proper layering**: Clean separation of concerns
- **Better disposal**: Automatic dependency cleanup
- **Consistent behavior**: Same disposal semantics as signals
- **Idempotent**: Safe to call multiple times
- **Error resilient**: One error doesn't block others

## Edge Cases

1. **Disposing already disposed scope**: Idempotent, no-op
2. **Error in cleanup function**: Caught, logged, other disposals continue
3. **Circular references**: Tree structure prevents cycles
4. **Detached scopes**: Can be disposed without parent
5. **GC timing**: WeakMap cleanup happens automatically

## Migration Path

1. **Day 1 morning**: Update `disposeScope()` implementation
2. **Day 1 afternoon**: Add disposal safety checks and helpers
3. **Day 1 evening**: Update map/match disposal calls
4. **Day 1 evening**: Add tests and verify no memory leaks

## Related Files

- `packages/view/src/helpers/scope.ts` - Main disposal logic
- `packages/view/src/map.ts` - Update item disposal
- `packages/view/src/match.ts` - Update branch disposal
- `packages/view/src/helpers/dispose.ts` - NEW: Disposal utilities
- `packages/view/src/types.ts` - Add disposal types
