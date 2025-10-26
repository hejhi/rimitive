/**
 * DEMO: How el.ts would be simplified with context-based scope management
 *
 * This shows the key differences between the current imperative pattern
 * and a declarative context-based pattern.
 */

import type { ElementRef } from '../types';
import { STATUS_ELEMENT } from '../types';

// ============================================================================
// CURRENT PATTERN (imperative, fragile)
// ============================================================================

function createElementCurrentPattern(
  createScope: any,
  runInScope: any,
  trackInSpecificScope: any,
  applyProps: any,
  processChildren: any,
  ctx: any,
  element: any,
  props: any,
  children: any,
  lifecycleCallbacks: any[]
) {
  const elRef: ElementRef<any> = {
    status: STATUS_ELEMENT,
    element,
    prev: undefined,
    next: undefined,
  };

  // Manual scope orchestration - 9 steps!
  const scope = createScope(element);                    // 1. Create
  ctx.elementScopes.set(element, scope);                 // 2. Register

  runInScope(scope, () => {                              // 3. Enter scope
    applyProps(element, props);                          // 4. Run code (contains effect+trackInScope)
    processChildren(elRef, children);                    // 5. Run more code
  });                                                     // 6. Exit scope

  for (const callback of lifecycleCallbacks) {           // 7. More manual tracking
    const cleanup = callback(element);
    if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
  }

  if (scope.firstDisposable === undefined) {             // 8. Check if empty
    ctx.elementScopes.delete(element);                   // 9. Cleanup if empty
  }

  return elRef;
}

// ============================================================================
// IMPROVED PATTERN (declarative, context-based)
// ============================================================================

function createElementImprovedPattern(
  withScope: any,         // Single helper that does all the orchestration
  applyProps: any,        // Now uses scopedEffect internally - no manual tracking
  processChildren: any,   // Same
  element: any,
  props: any,
  children: any,
  lifecycleCallbacks: any[]
) {
  const elRef: ElementRef<any> = {
    status: STATUS_ELEMENT,
    element,
    prev: undefined,
    next: undefined,
  };

  // Single declarative call - all orchestration is encapsulated!
  withScope(element, (scope) => {
    // Everything in here auto-tracks via activeScope context
    applyProps(element, props);      // Uses scopedEffect - auto-tracked
    processChildren(elRef, children); // Uses scopedEffect - auto-tracked

    // Lifecycle callbacks auto-tracked too
    for (const callback of lifecycleCallbacks) {
      const cleanup = callback(element);
      if (cleanup) {
        // Could even make onCleanup() helper that auto-tracks:
        // onCleanup(cleanup);
        // But for now, scope is available:
        scope.firstDisposable = {
          disposable: { dispose: cleanup },
          next: scope.firstDisposable
        };
      }
    }
  });

  return elRef;
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Benefits of context-based pattern:
 *
 * 1. **Less code**: 9 imperative steps → 1 declarative call
 * 2. **Fewer concepts**: No need to learn createScope, runInScope, trackInScope separately
 * 3. **Harder to misuse**: Can't forget to register or cleanup the scope
 * 4. **Auto-tracking**: Effects know their owner automatically
 * 5. **Better encapsulation**: Implementation details hidden
 *
 * This is similar to how SolidJS manages owners/scopes - the framework
 * tracks ownership automatically via context rather than requiring manual
 * orchestration at every call site.
 */
