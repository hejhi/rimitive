# Phase 1: Create RenderScope Type

**Duration:** 1-2 days

## Goal
Define a unified `RenderScope` interface that combines signals' `ScheduledNode` with view's `Scope`, serving as the foundation for the unified architecture.

## Background
Currently, view and signals have separate execution context structures:
- **Signals**: `EffectNode` extends `ScheduledNode` (reactive + scheduled)
- **View**: `Scope` has tree structure (parent/children/disposables)

These represent the same concept: "execution context with lifecycle." By merging them into `RenderScope`, we eliminate redundant allocations and enable automatic reactivity.

## Implementation Details

### 1. Define RenderScope Interface

Location: `packages/view/src/types.ts`

```typescript
import type { ScheduledNode, Dependency } from '@lattice/signals/types';

/**
 * RenderScope - Unified execution context for reactive UI components
 *
 * Combines:
 * - Signals' ScheduledNode (reactive tracking + scheduling)
 * - View's Scope (tree structure + disposal)
 *
 * Benefits:
 * - Single object per component (vs Scope + EffectNode)
 * - Automatic dependency tracking
 * - Efficient memory layout
 */
export interface RenderScope extends ScheduledNode {
  // ============ From ScheduledNode (signals) ============
  // __type: string;                              // 'render-scope'
  // status: number;                              // CLEAN | DIRTY | PENDING | DISPOSED + flags
  // dependencies: Dependency | undefined;         // Linked list of producers this depends on
  // dependencyTail: Dependency | undefined;       // Tail for O(1) tracking
  // trackingVersion: number;                      // Version during last track
  // nextScheduled: ScheduledNode | undefined;     // Next in scheduler queue
  // flush(): void;                                // Re-render logic

  // ============ From Scope (view) ============
  /** Parent scope in the UI tree */
  parent: RenderScope | undefined;

  /** First child scope (linked list head) */
  firstChild: RenderScope | undefined;

  /** Next sibling scope (linked list) */
  nextSibling: RenderScope | undefined;

  /** Head of disposables linked list (event listeners, subscriptions, etc.) */
  firstDisposable: DisposableNode | undefined;

  // ============ New unified fields ============
  /** The DOM element this scope manages (if any) */
  element?: unknown; // Generic - will be TElement in actual usage

  /** Cleanup function returned by render function */
  cleanup?: void | (() => void);
}

/**
 * Type guard - check if a node is a RenderScope
 */
export function isRenderScope(node: unknown): node is RenderScope {
  return (
    typeof node === 'object' &&
    node !== null &&
    '__type' in node &&
    (node as RenderScope).__type === 'render-scope'
  );
}
```

### 2. Update DisposableNode Type

Ensure `DisposableNode` is properly exported and documented:

```typescript
/**
 * Wrapper for disposables to form linked list
 * Used to track event listeners, subscriptions, etc. in a RenderScope
 */
export interface DisposableNode {
  disposable: Disposable;
  next: DisposableNode | undefined;
}
```

### 3. Update Context Types

Location: `packages/view/src/context.ts`

```typescript
import type { RenderScope } from './types';

/**
 * View context for concurrency-safe scope tracking
 *
 * FUTURE: Will be merged with signals' GlobalContext in Phase 2
 * For now, just update to use RenderScope instead of Scope
 */
export interface ViewContext {
  /**
   * Current active scope for tracking disposables and dependencies
   */
  currentScope: RenderScope | null;

  /**
   * Map element to its managing scope
   * Essential for event handling and DOM-based lookups
   */
  elementScopes: WeakMap<object, RenderScope>;
}
```

### 4. Add Type Exports

Location: `packages/view/src/types.ts`

```typescript
// Export for external use
export type { RenderScope, DisposableNode };
```

## Testing Strategy

1. **Type-level tests**: Ensure `RenderScope` is assignable to `ScheduledNode`
2. **Create basic RenderScope**: Verify all required fields can be initialized
3. **Type guard tests**: Test `isRenderScope()` function
4. **No runtime changes yet**: This phase is purely types

## Success Criteria

- [ ] `RenderScope` interface defined in `packages/view/src/types.ts`
- [ ] `isRenderScope()` type guard implemented
- [ ] `ViewContext` updated to use `RenderScope`
- [ ] All existing tests pass (no runtime changes)
- [ ] TypeScript compilation succeeds
- [ ] Documentation comments complete

## Notes

- This phase introduces the type but doesn't change any runtime behavior
- Existing `Scope` type can coexist during migration
- Next phase will update context to use unified type
- Keep `@lattice/signals` dependency at type-level only for now

## Related Files

- `packages/view/src/types.ts` - Main changes
- `packages/view/src/context.ts` - Context updates
- `packages/view/src/helpers/scope.ts` - Will be updated in Phase 3
- `packages/signals/src/types.ts` - Reference for `ScheduledNode`
