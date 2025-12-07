/**
 * Behavior binding helper
 *
 * Binds a portable behavior to a reactive service.
 * Behaviors are curried functions: (svc) => (...args) => Result
 */

import type { Readable, Writable } from '@lattice/signals/types';

/**
 * Type of the use helper returned by createUse
 *
 * @example
 * ```typescript
 * import type { Use } from '@lattice/view/deps/use';
 * import type { DOMViewSvc } from '@lattice/view/presets/dom';
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
 * import { createUse } from '@lattice/view/deps/use';
 * import { createSignals } from '@lattice/signals/presets/core';
 * import { createDOMView } from '@lattice/view/presets/dom';
 *
 * const svc = createDOMView({ signals: createSignals() })();
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
