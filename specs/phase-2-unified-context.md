# Phase 2: Unified Context

**Duration:** 1 day

## Goal
Merge `GlobalContext` (signals) and `ViewContext` (view) into a single unified context that tracks both reactive execution and disposal scopes.

## Background
Currently, signals and view maintain separate contexts:
- **signals/src/context.ts**: `GlobalContext { consumerScope, trackingVersion }`
- **view/src/context.ts**: `ViewContext { currentScope, elementScopes }`

Both `consumerScope` and `currentScope` track "current execution context" - they should be unified.

## Implementation Details

### 1. Create Unified Context Type

Location: `packages/lattice/src/context.ts` (new file in lattice core)

```typescript
import type { RenderScope } from '@lattice/view/types';

/**
 * Unified Lattice Context
 *
 * Shared between signals and view packages for:
 * - Reactive dependency tracking (signals)
 * - Disposal scope tracking (view)
 * - Element-to-scope mapping (view)
 *
 * Thread-safe for concurrent SSR
 */
export interface LatticeContext {
  /**
   * Current active execution scope
   * Used by:
   * - signals: Track reactive dependencies during computation
   * - view: Track disposables during component render
   */
  activeScope: RenderScope | null;

  /**
   * Global tracking version (incremented on each track cycle)
   * Used by signals for efficient dependency deduplication
   */
  trackingVersion: number;

  /**
   * Map DOM elements to their managing RenderScopes
   * Used by view for event handling and context lookups
   */
  elementScopes: WeakMap<object, RenderScope>;
}

/**
 * Create a new unified context
 */
export function createLatticeContext(): LatticeContext {
  return {
    activeScope: null,
    trackingVersion: 0,
    elementScopes: new WeakMap(),
  };
}
```

### 2. Update Signals to Use Unified Context

Location: `packages/signals/src/context.ts`

```typescript
/**
 * @deprecated Use LatticeContext from @lattice/lattice instead
 * This is maintained for backward compatibility
 */
export interface GlobalContext {
  consumerScope: ConsumerNode | null;
  trackingVersion: number;
}

export function createBaseContext(): GlobalContext {
  console.warn(
    'createBaseContext is deprecated. Use createLatticeContext from @lattice/lattice'
  );
  return {
    consumerScope: null,
    trackingVersion: 0,
  };
}

// Add compatibility layer
import type { LatticeContext } from '@lattice/lattice/context';

/**
 * Type guard to check if using new unified context
 */
export function isLatticeContext(ctx: unknown): ctx is LatticeContext {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    'activeScope' in ctx &&
    'elementScopes' in ctx
  );
}

/**
 * Adapter to use LatticeContext as GlobalContext
 * Maps activeScope -> consumerScope for backward compatibility
 */
export function adaptLatticeContext(ctx: LatticeContext): GlobalContext {
  return {
    get consumerScope() { return ctx.activeScope; },
    set consumerScope(value) { ctx.activeScope = value; },
    trackingVersion: ctx.trackingVersion,
  };
}
```

### 3. Update View to Use Unified Context

Location: `packages/view/src/context.ts`

```typescript
import { createLatticeContext, type LatticeContext } from '@lattice/lattice/context';

/**
 * @deprecated Use LatticeContext from @lattice/lattice instead
 * This is maintained for backward compatibility
 */
export interface ViewContext {
  currentScope: RenderScope | null;
  elementScopes: WeakMap<object, RenderScope>;
}

/**
 * @deprecated Use createLatticeContext from @lattice/lattice instead
 */
export function createViewContext(): ViewContext {
  console.warn(
    'createViewContext is deprecated. Use createLatticeContext from @lattice/lattice'
  );
  const ctx = createLatticeContext();
  return {
    get currentScope() { return ctx.activeScope; },
    set currentScope(value) { ctx.activeScope = value; },
    elementScopes: ctx.elementScopes,
  };
}

// Re-export the proper types
export type { LatticeContext };
export { createLatticeContext };
```

### 4. Update Type References

**In signals factories:**
```typescript
// Before
import type { GlobalContext } from './context';

export type EffectOpts = {
  ctx: GlobalContext;
  // ...
};

// After (with compatibility)
import type { LatticeContext } from '@lattice/lattice/context';
import type { GlobalContext } from './context';

export type EffectOpts = {
  ctx: LatticeContext | GlobalContext; // Accept both during migration
  // ...
};
```

**In view factories:**
```typescript
// Before
import type { ViewContext } from './context';

export type ElOpts = {
  ctx: ViewContext;
  // ...
};

// After
import type { LatticeContext } from '@lattice/lattice/context';

export type ElOpts = {
  ctx: LatticeContext;
  // ...
};
```

### 5. Update Context Access Patterns

**In signals/src/helpers/graph-edges.ts:**
```typescript
// Before
const trackDependency = (producer, consumer) => {
  // ...
  currDep.version = ctx.trackingVersion;
  // ...
};

// After - no change needed, works with both!
const trackDependency = (producer, consumer) => {
  // ...
  currDep.version = ctx.trackingVersion; // Same property name
  // ...
};
```

**In signals factories that set consumerScope:**
```typescript
// Before
ctx.consumerScope = node;

// After - use activeScope
ctx.activeScope = node;
```

**In view/src/helpers/scope.ts:**
```typescript
// Before
const prevScope = ctx.currentScope;
ctx.currentScope = scope;

// After - use activeScope
const prevScope = ctx.activeScope;
ctx.activeScope = scope;
```

## Migration Strategy

1. **Week 1**: Add `LatticeContext` to `@lattice/lattice`
2. **Week 1**: Update signals to accept both types (backward compatible)
3. **Week 1**: Update view to use `LatticeContext`
4. **Week 2**: Migrate test files to use `createLatticeContext()`
5. **Week 3**: Remove deprecated `GlobalContext` and `ViewContext`

## Testing Strategy

1. **Signals tests**: Should pass with both `GlobalContext` and `LatticeContext`
2. **View tests**: Update to use `createLatticeContext()`
3. **Integration tests**: Verify signals and view work together with unified context
4. **Type tests**: Ensure factories accept both context types during migration

## Success Criteria

- [ ] `LatticeContext` defined in `packages/lattice/src/context.ts`
- [ ] Signals factories accept `LatticeContext` (with backward compat)
- [ ] View factories use `LatticeContext` exclusively
- [ ] All existing tests pass
- [ ] Deprecation warnings in place for old contexts
- [ ] Documentation updated

## Benefits

- **Single context object**: Shared between packages
- **Reduced confusion**: One `activeScope` instead of two separate scopes
- **Foundation for Phase 3**: Enables seamless integration of signals' effect system

## Notes

- Maintain backward compatibility during migration
- Deprecation warnings help developers migrate
- `activeScope` is the new canonical name (replaces `consumerScope` and `currentScope`)
- `elementScopes` WeakMap is view-specific and remains in unified context

## Related Files

- `packages/lattice/src/context.ts` - New unified context
- `packages/signals/src/context.ts` - Add compatibility layer
- `packages/view/src/context.ts` - Use unified context
- `packages/signals/src/helpers/graph-edges.ts` - Update ctx access
- `packages/view/src/helpers/scope.ts` - Update ctx access
