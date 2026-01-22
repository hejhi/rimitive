/**
 * Behavior binding helper
 *
 * Binds a portable behavior to a reactive service.
 * Behaviors are curried functions: (svc) => (...args) => Result
 */

import type { Readable, Writable } from '@rimitive/signals/types';

/**
 * Type of the use helper returned by createUse
 *
 * @example
 * ```typescript
 * import type { Use } from '@rimitive/view/deps/use';
 * import type { Readable, Writable } from '@rimitive/signals/types';
 * import type { ElFactory } from '@rimitive/view/el';
 *
 * type DOMViewSvc = {
 *   signal: <T>(initialValue: T) => Writable<T>;
 *   computed: <T>(fn: () => T) => Readable<T>;
 *   effect: (fn: () => void | (() => void)) => () => void;
 *   batch: <T>(fn: () => T) => T;
 *   el: ElFactory<DOMTreeConfig>;
 * };
 *
 * const useHelper: Use<DOMViewSvc> = createUse(svc);
 *
 * // Define a reusable behavior
 * const clickHandler = (svc: DOMViewSvc) => (message: string) => {
 *   return svc.on('click', () => console.log(message));
 * };
 *
 * // Bind it to the service
 * const onClick = useHelper(clickHandler);
 * el('button').ref(onClick('Button clicked!'))('Click me');
 * ```
 */
export type Use<TSvc> = <Args extends unknown[], Result>(
  behavior: (svc: TSvc) => (...args: Args) => Result
) => (...args: Args) => Result;

/**
 * Creates a `use` helper bound to a specific reactive service.
 *
 * @example
 * ```typescript
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 * import { createElModule } from '@rimitive/view/el';
 * import { createUse } from '@rimitive/view/deps/use';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(SignalModule, ComputedModule, EffectModule, createElModule(adapter));
 * const use = createUse(svc);
 *
 * // Define a portable behavior that can work with any service
 * const autofocus = (svc: typeof svc) => () => {
 *   return (el: HTMLElement) => {
 *     if (el instanceof HTMLInputElement) {
 *       el.focus();
 *     }
 *   };
 * };
 *
 * // Bind behavior to this service instance
 * const useAutofocus = use(autofocus);
 *
 * // Use in components
 * el('input').ref(useAutofocus())();
 * ```
 */
export const createUse = <
  TSvc extends {
    signal: <T>(initialValue: T) => Writable<T>;
    computed: <T>(fn: () => T) => Readable<T>;
    effect: (fn: () => void | (() => void)) => () => void;
    batch: <T>(fn: () => T) => T;
  },
>(
  svc: TSvc
): Use<TSvc> => {
  return <Args extends unknown[], Result>(
    behavior: (svc: TSvc) => (...args: Args) => Result
  ): ((...args: Args) => Result) => {
    return behavior(svc);
  };
};
