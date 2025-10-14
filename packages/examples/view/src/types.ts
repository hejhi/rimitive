/**
 * Type definitions for the Lattice API with Signals + View
 */

import type { ElementRef, ElementSpec, Reactive } from '@lattice/view/types';

/**
 * Combined Lattice API with signals and view primitives
 */
export interface LatticeViewAPI {
  // Signal primitives
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  computed: <T>(fn: () => T) => Reactive<T>;
  effect: (fn: () => void | (() => void)) => () => void;

  // View primitives
  el: (spec: ElementSpec) => ElementRef;
  elMap: <T>(
    items: () => T[],
    render: (item: Reactive<T>) => ElementRef,
    keyFn?: (item: T) => unknown
  ) => ElementRef;
}
