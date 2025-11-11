/**
 * ReactiveAdapter - Minimal interface for reactive systems to integrate with @lattice/view
 *
 * This defines the protocol for what it means to be a reactive system compatible
 * with @lattice/view. Similar to React's useSyncExternalStore, this establishes
 * a clear contract between the view layer and the underlying reactive system.
 *
 * Any reactive system (Solid, Vue, MobX, Preact Signals, etc.) can power @lattice/view
 * as long as it implements these three primitives.
 */

import type { Reactive } from './types';

/**
 * Writable signal interface - extends Readable with setter
 */
export interface WritableSignal<T> extends Reactive<T> {
  (value: T): void;
}

/**
 * Minimal reactive system interface that view can integrate with.
 *
 * Consists of three fundamental primitives:
 * 1. signal - Create reactive state that notifies dependents on change
 * 2. effect - React to changes by auto-tracking dependencies
 * 3. batch - Optimize multiple updates into a single reactive cycle
 */
export interface ReactiveAdapter {
  /**
   * Create reactive state that notifies on change.
   *
   * Returns a readable/writable signal:
   * - Call with no args to read (tracks dependency)
   * - Call with arg to write (notifies dependents)
   *
   * @example
   * const count = signal(0);
   * count();      // => 0 (read)
   * count(5);     // => void (write)
   * count();      // => 5
   */
  signal<T>(initialValue: T): WritableSignal<T>;

  /**
   * React to changes in reactive state.
   * Auto-tracks signals read during execution and re-runs when they change.
   *
   * Returns a dispose function to stop tracking.
   * The effect function can optionally return a cleanup function.
   *
   * @example
   * const dispose = effect(() => {
   *   console.log('Count is:', count());
   *   return () => console.log('Cleanup');
   * });
   */
  effect(fn: () => void | (() => void)): () => void;

  /**
   * Batch multiple updates into a single reactive cycle.
   * Defers effect execution until the batch completes.
   *
   * Critical for performance when multiple signals are updated together
   * (e.g., in event handlers).
   *
   * @example
   * batch(() => {
   *   firstName.set('Alice');
   *   lastName.set('Smith');
   *   age.set(30);
   * }); // Only triggers one effect execution
   */
  batch<T>(fn: () => T): T;
}
