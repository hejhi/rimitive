/**
 * Type definitions for the Lattice API with Signals + View
 */

import type { ElementRef, ElementSpec, Reactive, DeferredListRef } from '@lattice/view/types';
import type { SignalFunction } from '@lattice/signals/signal';
import type { ComputedFunction } from '@lattice/signals/computed';

/**
 * Combined Lattice API with signals and view primitives
 * Uses actual exported types from @lattice/signals and @lattice/view
 */
export interface LatticeViewAPI {
  // Signal primitives (from @lattice/signals)
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;

  // View primitives (from @lattice/view)
  el: <T extends keyof HTMLElementTagNameMap>(spec: ElementSpec<T>) => ElementRef<HTMLElementTagNameMap[T]>;
  elMap: <T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef,
    keyFn: (item: T) => string | number
  ) => DeferredListRef;
}
