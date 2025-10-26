# Eliminating `trackInSpecificScope` with `onCleanup`

## The Problem

`trackInSpecificScope` allowed you to manually reach across scope boundaries to track disposables in a different scope:

```typescript
const scope = createScope(element);
trackInSpecificScope(scope, { dispose: cleanup }); // Dangerous!
```

This felt fragile and dangerous because:
1. **Breaks encapsulation** - You're reaching outside the current context
2. **Error-prone** - Easy to target the wrong scope
3. **Non-obvious** - The scope parameter is redundant when you're already inside that scope

## The Investigation

**Only production use:** el.ts:137
```typescript
withScope(element, (scope) => {
  // ...
  for (const callback of lifecycleCallbacks) {
    const cleanup = callback(element);
    if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
    //                ↑ Redundant! We're already inside this scope
  }
});
```

The irony: Inside `withScope`, the `scope` parameter **IS** the `activeScope` (see with-scope.ts:72). We're using `trackInSpecificScope` when the scope is already active!

## The Solution: `onCleanup`

A simple, declarative helper that tracks cleanup in the active scope:

```typescript
// packages/view/src/helpers/on-cleanup.ts
export function createOnCleanup(ctx: LatticeContext) {
  return function onCleanup(cleanup: () => void): void {
    const scope = ctx.activeScope;
    if (!scope) return;

    scope.firstDisposable = {
      disposable: { dispose: cleanup },
      next: scope.firstDisposable,
    };
  };
}
```

## Before vs After

**Before (manual, error-prone):**
```typescript
withScope(element, (scope) => {
  const cleanup = callback(element);
  if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
  //           ^^^^^^^^^^^^^^^^^^^^ Explicitly pass scope
});
```

**After (declarative, safe):**
```typescript
withScope(element, () => {
  const cleanup = callback(element);
  if (cleanup) onCleanup(cleanup);
  //           ^^^^^^^^^ Uses active scope automatically
});
```

## Benefits

1. **Safer** - Can't accidentally target the wrong scope
2. **Cleaner** - No need to pass scope around
3. **Familiar** - Matches SolidJS `onCleanup()`, Vue `onUnmounted()`, React `useEffect(() => cleanup)`
4. **Encapsulated** - Works within the current context, no reaching across boundaries

## API Surface Reduction

### Removed from Production
- `trackInSpecificScope` - Completely eliminated from production code

### Added
- `onCleanup` - Simple, context-aware cleanup registration

## Implementation

- Created `packages/view/src/helpers/on-cleanup.ts`
- Updated `el.ts` to use `onCleanup` instead of `trackInSpecificScope`
- Removed `trackInSpecificScope` from `ElOpts` type
- All 192 tests pass ✅

## Migration Guide

```diff
  withScope(element, (scope) => {
-   const cleanup = doSomething();
-   if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
+   const cleanup = doSomething();
+   if (cleanup) onCleanup(cleanup);
  });
```

## Philosophy

This change aligns with the broader refactoring theme: **replace manual orchestration with context-based auto-tracking**.

Just like `scopedEffect` eliminated `effect + trackInScope`, and `withScope` eliminated `createScope + ctx.activeScope = ...`, `onCleanup` eliminates the last remaining case of manual scope targeting.

The pattern: **Trust the context, don't reach across boundaries.**
