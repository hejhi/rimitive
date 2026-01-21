import { useEffect, useRef } from 'react';
import { compose } from '@rimitive/core';
import type { Module, Use, ComposedContext, ContainsLazy } from '@rimitive/core';

/**
 * Type error message for lazy modules in React hooks
 */
type LazyModuleError =
  'Error: Lazy modules are not supported in useRimitiveContext. Use compose() with await outside the component.';

/**
 * Create a Rimitive context with modules that is scoped to the component lifecycle.
 * The context will be automatically disposed when the component unmounts.
 *
 * Note: Lazy modules (async create) are not supported. For async modules,
 * use `compose()` with `await` outside the component and pass the result via props or context.
 *
 * @param modules - The Rimitive modules to include in the context (must be sync)
 * @returns A Use context with implementations from all provided modules
 *
 * @example
 * ```tsx
 * import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
 *
 * function App() {
 *   // Create a context with specific modules
 *   const use = useRimitiveContext(SignalModule, ComputedModule, EffectModule);
 *
 *   const count = useRef(use.signal(0));
 *   const doubled = useRef(use.computed(() => count.current() * 2));
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // For simpler cases, you can use compose directly in a ref
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
 *
 * function TodoApp() {
 *   const svc = useRef(compose(SignalModule, ComputedModule, EffectModule));
 *   const { signal } = svc.current;
 *
 *   const todos = useRef(signal([]));
 *   const filter = useRef(signal('all'));
 *
 *   // Dispose on unmount
 *   useEffect(() => () => svc.current.dispose(), []);
 *
 *   return (
 *     <AppContext.Provider value={{ todos: todos.current, filter: filter.current }}>
 *       <TodoList />
 *     </AppContext.Provider>
 *   );
 * }
 * ```
 */
export function useRimitiveContext<M extends Module[]>(
  ...modules: ContainsLazy<M> extends true ? [LazyModuleError] : M
): Use<ComposedContext<M>> {
  // Create context only once, using ref to ensure stability
  const contextRef = useRef<Use<ComposedContext<M>> | null>(null);

  if (!contextRef.current) {
    // Type assertion is safe here because:
    // 1. HasLazyModule constraint prevents lazy modules at the type level
    // 2. If lazy modules slip through, compose() would return a Promise
    //    which would cause a runtime error (intentional fail-fast behavior)
    contextRef.current = compose(
      ...(modules as Module[])
    ) as Use<ComposedContext<M>>;
  }

  const context = contextRef.current;

  // Dispose on unmount
  useEffect(() => {
    return () => context.dispose();
  }, [context]);

  return context;
}
