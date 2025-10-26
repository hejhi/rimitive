# Scope Management Refactoring Proposal

## Problem Statement

Currently, `el()` and `map()` manually orchestrate scope lifecycle through imperative steps:

```typescript
// Current pattern in el.ts
const scope = createScope(element);
ctx.elementScopes.set(element, scope);
runInScope(scope, () => {
  applyProps(element, props);
  processChildren(elRef, children);
});
for (const callback of lifecycleCallbacks) {
  const cleanup = callback(element);
  if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
}
if (scope.firstDisposable === undefined) {
  ctx.elementScopes.delete(element);
}
```

```typescript
// Current pattern in map.ts
const dispose = effect(() => { /* reconcile */ });
const parentScope = ctx.elementScopes.get(parent.element);
if (parentScope) trackInSpecificScope(parentScope, { dispose });
```

### Issues with Current Approach

1. **Fragile**: Easy to forget steps (register, run in scope, track, cleanup)
2. **Imperative**: Implementation details leak to call sites
3. **Verbose**: Repetitive boilerplate at every usage
4. **Error-prone**: Manual WeakMap management can be forgotten
5. **Conceptual overhead**: Need to understand 5+ separate functions

## Proposed Solution: Context-Based Scope Management

Inspired by SolidJS's owner pattern, make scopes work via context rather than manual orchestration.

### New Primitives

#### 1. Auto-Tracking Effect (`scopedEffect`)

```typescript
// BEFORE: Manual tracking
const dispose = effect(() => ...);
trackInScope({ dispose });

// AFTER: Auto-tracking via context
scopedEffect(() => ...); // Automatically tracked in activeScope
```

**Implementation**: `packages/view/src/helpers/scoped-effect.ts`

#### 2. Declarative Scope Entry (`withScope`)

```typescript
// BEFORE: 9 imperative steps
const scope = createScope(element);
ctx.elementScopes.set(element, scope);
runInScope(scope, () => {
  // setup
});
if (scope.firstDisposable === undefined) {
  ctx.elementScopes.delete(element);
}

// AFTER: 1 declarative call
withScope(element, (scope) => {
  // setup - everything auto-tracked
});
```

**Implementation**: `packages/view/src/helpers/with-scope.ts`

#### 3. Parent Scope Access (`withElementScope`)

```typescript
// BEFORE: Manual lookup + context management
const parentScope = ctx.elementScopes.get(parent.element);
if (parentScope) {
  const prev = ctx.activeScope;
  ctx.activeScope = parentScope;
  try {
    // code
  } finally {
    ctx.activeScope = prev;
  }
}

// AFTER: Single helper
withElementScope(ctx, parent.element, () => {
  // code runs in parent's scope
});
```

## Migration Path

### Phase 1: Add New Helpers (Non-Breaking)

1. Create `scoped-effect.ts` ✅
2. Create `with-scope.ts` ✅
3. Add tests for new helpers
4. Export from main entry points

### Phase 2: Refactor Internal Usage

1. Update `el.ts` to use `withScope` and `scopedEffect`
2. Update `map.ts` to use `withElementScope` and `scopedEffect`
3. Update `applyProps` to use `scopedEffect` internally
4. Update `processChildren` to use `scopedEffect` internally

### Phase 3: Deprecate Old API (Breaking Change)

1. Mark `createScope`, `runInScope`, `trackInScope` as deprecated
2. Update documentation
3. Provide codemod if needed

### Phase 4: Remove Old API

1. Remove deprecated functions
2. Simplify internal implementation

## Benefits

### For Users

- **Simpler mental model**: Scopes work automatically via context
- **Less code**: Fewer function calls, less boilerplate
- **Fewer errors**: Harder to misuse or forget steps
- **Better composability**: Effects naturally compose with scopes

### For Maintainers

- **Better encapsulation**: Implementation details hidden
- **Easier to reason about**: Declarative > imperative
- **Less surface area**: Fewer exported functions
- **Aligned with ecosystem**: Pattern used by Solid, Vue Composition API

## Example: Before vs After

### Element Creation

```typescript
// BEFORE (el.ts)
const scope = createScope(element);
ctx.elementScopes.set(element, scope);
runInScope(scope, () => {
  applyProps(element, props);
  processChildren(elRef, children);
});
for (const callback of lifecycleCallbacks) {
  const cleanup = callback(element);
  if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
}
if (scope.firstDisposable === undefined) {
  ctx.elementScopes.delete(element);
}

// AFTER
withScope(element, (scope) => {
  applyProps(element, props);
  processChildren(elRef, children);
  lifecycleCallbacks.forEach(cb => {
    const cleanup = cb(element);
    if (cleanup) onCleanup(cleanup); // or scope.track()
  });
});
```

### Map/Fragment Attachment

```typescript
// BEFORE (map.ts)
const dispose = effect(() => {
  // reconciliation logic
});
const parentScope = ctx.elementScopes.get(parent.element);
if (parentScope) trackInSpecificScope(parentScope, { dispose });

// AFTER
withElementScope(ctx, parent.element, () => {
  scopedEffect(() => {
    // reconciliation logic
  });
});
```

### Reactive Props

```typescript
// BEFORE (applyProps)
function applyProps(element, props) {
  for (const [key, val] of Object.entries(props)) {
    if (isReactive(val)) {
      const dispose = effect(() => renderer.setAttribute(element, key, val()));
      trackInScope({ dispose });
    }
  }
}

// AFTER
function applyProps(element, props) {
  for (const [key, val] of Object.entries(props)) {
    if (isReactive(val)) {
      scopedEffect(() => renderer.setAttribute(element, key, val()));
    }
  }
}
```

## Implementation Status

- [x] Create `scoped-effect.ts`
- [x] Create `with-scope.ts`
- [x] Create demo files showing pattern
- [ ] Add tests for new helpers
- [ ] Refactor `el.ts` to use new pattern
- [ ] Refactor `map.ts` to use new pattern
- [ ] Refactor `applyProps` to use new pattern
- [ ] Refactor `processChildren` to use new pattern
- [ ] Update documentation
- [ ] Add migration guide

## Open Questions

1. Should we keep low-level APIs (`createScope`, `runInScope`) as "advanced" exports?
2. Do we need an `onCleanup()` helper for symmetry with other frameworks?
3. Should `scopedEffect` be the default, or should users opt-in?
4. How do we handle SSR where scopes exist but effects shouldn't run?

## Related Patterns

- **SolidJS**: Uses `Owner` context for automatic cleanup tracking
- **Vue Composition API**: Uses `getCurrentInstance()` for auto-tracking
- **React**: Uses Fiber tree for automatic cleanup (useEffect)
- **Svelte**: Uses component context for $: reactive statements

The proposed pattern aligns with industry best practices while maintaining Lattice's zero-abstraction philosophy.
