/**
 * @fileoverview Scoped lattice context implementation
 *
 * Provides isolated signal/computed contexts for component trees,
 * eliminating global state conflicts and enabling proper composition.
 */

import type { LatticeContext } from './types';
import { 
  signal as globalSignal, 
  computed as globalComputed, 
  effect as globalEffect, 
  batch,
  type Signal,
  type Computed
} from '@lattice/signals';

/**
 * Internal context state
 */
interface ContextState {
  disposed: boolean;
  signals: Set<Signal<unknown>>;
  computeds: Set<Computed<unknown>>;
  effectDisposers: Set<() => void>;
}

/**
 * Internal context type with state
 */
interface LatticeContextImpl extends LatticeContext {
  _state: ContextState;
  dispose(): void;
}

/**
 * Tracks which signals belong to which context for boundary enforcement
 */
const contextMap = new WeakMap<Signal<unknown> | Computed<unknown>, LatticeContextImpl>();

/**
 * Context constructor function
 */
function LatticeContextImplConstructor(this: LatticeContextImpl) {
  this._state = {
    disposed: false,
    signals: new Set<Signal<unknown>>(),
    computeds: new Set<Computed<unknown>>(),
    effectDisposers: new Set<() => void>(),
  };
}

// Cast to constructor type
const LatticeContextImplCtor = LatticeContextImplConstructor as unknown as {
  new (): LatticeContextImpl;
  prototype: LatticeContextImpl;
};

// Define the prototype
const proto = LatticeContextImplCtor.prototype;

proto.signal = function <T>(this: LatticeContextImpl, initialValue: T): Signal<T> {
  if (this._state.disposed) {
    throw new Error('Cannot create signal in disposed context');
  }

  const sig = globalSignal(initialValue);
  this._state.signals.add(sig as Signal<unknown>);
  contextMap.set(sig as Signal<unknown>, this);
  return sig;
};

proto.computed = function <T>(this: LatticeContextImpl, computeFn: () => T): Computed<T> {
  if (this._state.disposed) {
    throw new Error('Cannot create computed in disposed context');
  }

  const comp = globalComputed(computeFn);
  this._state.computeds.add(comp as Computed<unknown>);
  contextMap.set(comp as Computed<unknown>, this);
  return comp;
};

proto.effect = function (this: LatticeContextImpl, effectFn: () => void | (() => void)): () => void {
  if (this._state.disposed) {
    throw new Error('Cannot create effect in disposed context');
  }

  const dispose = globalEffect(effectFn);
  const effectDisposers = this._state.effectDisposers;
  effectDisposers.add(dispose);
  
  // Return a wrapped disposer that also removes from our tracking
  return () => {
    dispose();
    effectDisposers.delete(dispose);
  };
};

proto.batch = batch;

proto.dispose = function (this: LatticeContextImpl): void {
  const state = this._state;
  if (state.disposed) return;
  state.disposed = true;

  // Dispose all effects
  for (const dispose of state.effectDisposers) {
    dispose();
  }
  state.effectDisposers.clear();

  // Dispose all computeds
  for (const computed of state.computeds) {
    computed.dispose();
    contextMap.delete(computed);
  }
  state.computeds.clear();

  // Clean up signal tracking
  for (const signal of state.signals) {
    contextMap.delete(signal);
  }
  state.signals.clear();
};

/**
 * Creates a scoped lattice context for a component tree
 */
export function createLatticeContext(): LatticeContext & { dispose(): void } {
  // Create new context implementation
  const impl = new LatticeContextImplCtor();
  
  // Create the public interface - bind methods to preserve 'this'
  return {
    signal: impl.signal.bind(impl),
    computed: impl.computed.bind(impl),
    effect: impl.effect.bind(impl),
    batch: impl.batch,
    dispose: impl.dispose.bind(impl),
  };
}
