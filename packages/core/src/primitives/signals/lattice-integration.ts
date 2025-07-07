// Production integration of signals with Lattice
// Minimal greenfield approach - just add subscribe for framework compatibility

import type {
  Signal as LatticeSignal,
  Computed as LatticeComputed,
} from '../../component/types';
import type { Signal as InternalSignal } from './types';
import { createScopedSignalFactory } from './signal';
import { createEffectScope } from './effect';
import { createSubscribeScope } from './subscribe';
import { createUnifiedScope } from './scope';
import { createComputedScope } from './computed';
import { createSelectFactory } from './select';

// Create the signal factory for Lattice context
export function createSignalFactory() {
  const scope = createUnifiedScope();
  const { signal: createSignal } = createScopedSignalFactory();
  const { effect: createEffect } = createEffectScope();
  const { computed: createComputed } = createComputedScope();
  function effect(effectFn: () => void | (() => void)): () => void {
    let cleanupFn: (() => void) | void;

    // Create wrapped effect that handles cleanup
    const dispose = createEffect(() => {
      // Run previous cleanup if exists
      if (cleanupFn) cleanupFn();

      // Run effect and capture new cleanup
      cleanupFn = effectFn();
    });

    // Return dispose function that also runs final cleanup
    return () => {
      dispose();
      if (cleanupFn) cleanupFn();
    };
  }

  const { subscribe } = createSubscribeScope(effect);
  const createSelect = createSelectFactory(createComputed, subscribe);

  function signal<T>(initialValue: T): LatticeSignal<T> {
    const signalInstance = createSignal(initialValue);

    // Add subscribe method to the existing object (maintains stable shape)
    signalInstance.subscribe = (listener: () => void) =>
      subscribe(signalInstance, listener);
      
    // Add select method for fine-grained subscriptions
    signalInstance.select = <R>(selector: (value: T) => R) =>
      createSelect(signalInstance, selector);

    return signalInstance as unknown as LatticeSignal<T>;
  }

  function computed<T>(computeFn: () => T): LatticeComputed<T> {
    const computedInstance = createComputed(computeFn);

    // Add subscribe method to the existing object (maintains stable shape)
    computedInstance.subscribe = (listener: () => void) =>
      subscribe(computedInstance, listener);
      
    // Add select method for fine-grained subscriptions
    computedInstance.select = <R>(selector: (value: T) => R) =>
      createSelect(computedInstance, selector);

    return computedInstance as unknown as LatticeComputed<T>;
  }

  function set<T>(latticeSignal: LatticeSignal<T>, value: T): void {
    // Direct assignment via setter using internal type
    (latticeSignal as unknown as InternalSignal<T>).value = value;
  }

  return {
    signal,
    computed,
    batch: (fn: () => void) => scope.batch(fn),
    effect,
    subscribe,
    set,
  };
}
