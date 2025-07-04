// Production integration of signals with Lattice
// Minimal greenfield approach - just add subscribe for framework compatibility

import type {
  Signal as LatticeSignal,
  Computed as LatticeComputed,
} from '../../component/types';
import { createScopedSignalFactory } from './signal';
import { createEffectScope } from './effect';
import { createSubscribeScope } from './subscribe';
import { createSignalScope } from './scope';
import { createBatchScope } from './batch';
import { createComputedScope } from './computed';
import { createNodeScope } from './node';

// Create the signal factory for Lattice context
export function createSignalFactory() {
  const scope = createSignalScope();
  const batch = createBatchScope();
  const node = createNodeScope();
  const { signal: createSignal, writeSignal } = createScopedSignalFactory(
    scope,
    batch,
    node
  );
  const { effect: createEffect } = createEffectScope(scope, batch, node);
  const { computed: createComputed } = createComputedScope(scope, node);

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

  function signal<T>(initialValue: T): LatticeSignal<T> {
    const signalInstance = createSignal(initialValue);

    // Add subscribe method to the existing object (maintains stable shape)
    signalInstance.subscribe = (listener: () => void) => subscribe(signalInstance, listener);

    return signalInstance as LatticeSignal<T>;
  }

  function computed<T>(computeFn: () => T): LatticeComputed<T> {
    const computedInstance = createComputed(computeFn);

    // Add subscribe method to the existing object (maintains stable shape)
    computedInstance.subscribe = (listener: () => void) => subscribe(computedInstance, listener);

    return computedInstance as LatticeComputed<T>;
  }

  function set<T>(latticeSignal: LatticeSignal<T>, value: T): void {
    writeSignal(
      latticeSignal as unknown as Parameters<typeof writeSignal>[0],
      value
    );
  }

  return {
    signal,
    computed,
    batch: batch.batch,
    effect,
    subscribe,
    set,
  };
}
