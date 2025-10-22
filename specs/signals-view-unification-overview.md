# Signals-View Unification: Architecture Overview

## Executive Summary

This specification outlines a systematic refactoring to unify `@lattice/signals` and `@lattice/view` by merging their execution context models. The core insight: a view `Scope` and a signals `EffectNode` represent the same concept and should be unified.

## The Problem

Currently, signals and view maintain parallel but disconnected systems:

| Aspect | Signals | View | Problem |
|--------|---------|------|---------|
| **Context** | `GlobalContext { consumerScope, trackingVersion }` | `ViewContext { currentScope, elementScopes }` | Duplicate tracking |
| **Node Type** | `EffectNode` (reactive + scheduled) | `Scope` (tree + disposables) | Redundant allocations |
| **Effect** | Automatic dependency tracking | Manual subscription management | More code, less power |
| **Batching** | Built-in scheduler | None | Immediate updates (slow) |
| **Disposal** | `scheduler.dispose()` | `disposeScope()` | Duplicate logic |

**Impact:**
- 2 objects per component (Scope + EffectNode)
- Manual subscription code
- No automatic batching (3-10x slower)
- Code duplication

## The Solution

Unify the systems through a single `RenderScope` that serves both roles:

```typescript
interface RenderScope extends ScheduledNode {
  // From signals (reactive):
  __type: 'render-scope';
  status: number;
  dependencies: Dependency | undefined;
  flush(): void;

  // From view (tree):
  parent: RenderScope | undefined;
  firstChild: RenderScope | undefined;
  element?: TElement;
  cleanup?: () => void;
}
```

**Benefits:**
- **-40% memory**: One object instead of two
- **+200-300% performance**: Automatic batching
- **-500 LOC**: Unified patterns
- **Better DX**: Components are just effects

## Implementation Phases

### Phase 1: Create RenderScope Type (1-2 days)
**Status:** 🔴 Not Started

Define the unified `RenderScope` interface that combines `ScheduledNode` and `Scope`.

**Key Files:**
- `packages/view/src/types.ts` - Define RenderScope
- `packages/view/src/context.ts` - Update to use RenderScope

**Deliverables:**
- [ ] RenderScope interface
- [ ] Type guard `isRenderScope()`
- [ ] Updated ViewContext
- [ ] All tests pass (type-only changes)

📄 **Full Spec:** [phase-1-render-scope-type.md](./phase-1-render-scope-type.md)

---

### Phase 2: Unified Context (1 day)
**Status:** 🔴 Not Started
**Depends On:** Phase 1

Merge `GlobalContext` and `ViewContext` into `LatticeContext`.

**Key Changes:**
```typescript
// Before: Two contexts
signals: { consumerScope, trackingVersion }
view:    { currentScope, elementScopes }

// After: One context
lattice: { activeScope, trackingVersion, elementScopes }
```

**Key Files:**
- `packages/lattice/src/context.ts` - NEW: Unified context
- `packages/signals/src/context.ts` - Add compatibility layer
- `packages/view/src/context.ts` - Use unified context

**Deliverables:**
- [ ] LatticeContext in @lattice/lattice
- [ ] Backward compatibility for signals
- [ ] View updated to use LatticeContext
- [ ] All tests pass

📄 **Full Spec:** [phase-2-unified-context.md](./phase-2-unified-context.md)

---

### Phase 3: Integrate Signals Effect (2-3 days)
**Status:** 🔴 Not Started
**Depends On:** Phase 2

Replace view's custom effect with signals' real effect system.

**Key Changes:**
- `createScope()` uses `graphEdges.track()` for automatic dependency tracking
- `disposeScope()` uses `scheduler.dispose()` for cleanup
- Remove custom effect implementation (~50 lines)

**Key Files:**
- `packages/view/src/helpers/scope.ts` - Use signals' track()
- `packages/view/src/test-utils.ts` - Remove custom effect
- `packages/view/src/el.ts` - Update factory opts

**Deliverables:**
- [ ] Scopes track dependencies automatically
- [ ] Custom effect code removed
- [ ] All tests pass
- [ ] New reactivity tests pass

📄 **Full Spec:** [phase-3-integrate-signals-effect.md](./phase-3-integrate-signals-effect.md)

---

### Phase 4: Automatic Batching (1 day)
**Status:** 🔴 Not Started
**Depends On:** Phase 3

Wrap event handlers with signals' batch system for automatic batching.

**Key Changes:**
```typescript
// Before: 3 signal updates = 3 DOM updates
onClick(() => {
  count(1);  // Update #1
  name('Bob');  // Update #2
  active(true);  // Update #3
})

// After: 3 signal updates = 1 batched DOM update
onClick(() => {
  count(1);
  name('Bob');
  active(true);
  // Single flush after endBatch()
})
```

**Key Files:**
- `packages/view/src/helpers/batch.ts` - NEW: Batching utilities
- `packages/view/src/on.ts` - Wrap handlers with batch

**Deliverables:**
- [ ] `withBatch()` helper implemented
- [ ] Event handlers automatically batch
- [ ] Performance benchmarks show 3-10x improvement
- [ ] All tests pass

📄 **Full Spec:** [phase-4-automatic-batching.md](./phase-4-automatic-batching.md)

---

### Phase 5: Unified Disposal (1 day)
**Status:** 🔴 Not Started
**Depends On:** Phase 3

Layer view disposal over signals' scheduler disposal.

**Key Changes:**
```typescript
const disposeScope = (scope: RenderScope) => {
  // 1. Signals handles reactive cleanup
  scheduler.dispose(scope, cleanupFn);

  // 2. View handles tree disposal
  disposeChildren(scope);

  // 3. Dispose other tracked items
  disposeTrackedItems(scope);
};
```

**Key Files:**
- `packages/view/src/helpers/scope.ts` - Update disposeScope()
- `packages/view/src/map.ts` - Update item disposal
- `packages/view/src/match.ts` - Update branch disposal

**Deliverables:**
- [ ] `disposeScope()` uses `scheduler.dispose()`
- [ ] Proper layering (signals graph + view tree)
- [ ] Memory leak tests pass
- [ ] All tests pass

📄 **Full Spec:** [phase-5-unified-disposal.md](./phase-5-unified-disposal.md)

---

## Timeline

```
Week 1:
├─ Mon-Tue: Phase 1 (RenderScope type)
├─ Wed:     Phase 2 (Unified context)
└─ Thu-Fri: Phase 3 start (Signals effect)

Week 2:
├─ Mon:     Phase 3 complete + testing
├─ Tue:     Phase 4 (Automatic batching)
└─ Wed:     Phase 5 (Unified disposal)
```

**Total Duration:** 6-8 days

## Estimated Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Memory per component | 2 objects | 1 object | **-50%** |
| Event handler performance | 1x | 3-10x | **+200-300%** |
| Code size (view + signals) | ~8200 LOC | ~7700 LOC | **-500 LOC** |
| Manual subscription code | ~50 lines | 0 lines | **-100%** |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes | Medium | High | Backward compat, deprecation warnings |
| Performance regression | Low | High | Benchmark each phase |
| Complexity increase | Low | Medium | Clear layering, good docs |
| Integration bugs | Medium | Medium | Comprehensive test suite |

## Success Metrics

- [ ] All existing tests pass
- [ ] Performance benchmarks show improvement
- [ ] Memory usage reduced by 40%
- [ ] Code size reduced by 500 LOC
- [ ] Zero breaking changes (backward compat maintained)

## Dependencies

```
External:
- @lattice/signals (already a peer dependency)
- No new external dependencies

Internal:
- Phase 2 depends on Phase 1
- Phase 3 depends on Phase 2
- Phase 4 depends on Phase 3
- Phase 5 depends on Phase 3
```

## Future Opportunities

After this unification, new capabilities become possible:

1. **Suspense**: RenderScope as async boundary
2. **Concurrent Rendering**: Scheduler priorities
3. **Time-Slicing**: Interruptible renders
4. **Server Components**: SSR with streaming
5. **Dev Tools**: Unified debugging across signals + view

## References

- Original discussion: [signals-view-unification conversation]
- Signals architecture: `packages/signals/src/types.ts`
- View architecture: `packages/view/src/types.ts`
- Lattice core: `packages/lattice/src/api.ts`

---

## Getting Started

To begin implementation:

1. Read Phase 1 spec: [phase-1-render-scope-type.md](./phase-1-render-scope-type.md)
2. Create feature branch: `git checkout -b feat/signals-view-unification`
3. Implement Phase 1 changes
4. Run tests: `pnpm --filter @lattice/view check`
5. Move to Phase 2

**Questions?** Review individual phase specs for detailed implementation guidance.
