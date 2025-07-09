import type { LatticeContext, Store, SignalState } from '@lattice/core';
import type { Signal, Computed } from '@lattice/signals';
import {
  createLattice as originalCreateLattice,
} from '@lattice/core';

export interface DevToolsEvent {
  type: string;
  timestamp: number;
  contextId: string;
  data?: any;
}

export interface DevToolsOptions {
  name?: string;
  enableProfiling?: boolean;
}

let devToolsEnabled = false;
let eventBuffer: DevToolsEvent[] = [];
const MAX_BUFFER_SIZE = 10000;

// Generate unique IDs
let idCounter = 0;
const generateId = (prefix: string) => `${prefix}_${++idCounter}`;

// Track context metadata - use Map instead of WeakMap for iteration
const contextMetadata = new Map<
  LatticeContext,
  {
    id: string;
    name: string;
    signals: Set<any>;
    computeds: Set<any>;
    effects: Set<() => void>;
  }
>();

// Track signal/computed metadata
const signalMetadata = new WeakMap<
  any,
  {
    id: string;
    name?: string;
    contextId: string;
  }
>();

const computedMetadata = new WeakMap<
  any,
  {
    id: string;
    name?: string;
    contextId: string;
    dependencies: Set<any>;
  }
>();

const effectMetadata = new WeakMap<
  any,
  {
    id: string;
    name?: string;
    contextId: string;
  }
>();

// Track the currently executing computed/effect
let currentlyExecuting: {
  type: 'computed' | 'effect';
  id: string;
  name?: string;
} | null = null;

// Track internal operations
let internalOperation: string | null = null;

// Track transaction count for snapshots (removed - no longer needed)

function emitEvent(event: Omit<DevToolsEvent, 'timestamp'>) {
  if (!devToolsEnabled) return;

  const fullEvent = { ...event, timestamp: Date.now() };
  eventBuffer.push(fullEvent);

  // Keep buffer size under control
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer = eventBuffer.slice(-MAX_BUFFER_SIZE / 2);
  }

  // Send to devtools if connected
  if (
    typeof window !== 'undefined' &&
    (window as any).__LATTICE_DEVTOOLS_BRIDGE__
  ) {
    (window as any).__LATTICE_DEVTOOLS_BRIDGE__.send(fullEvent);
  }

}

export function enableDevTools(options: DevToolsOptions = {}) {
  devToolsEnabled = true;

  // Install global hook for extension to detect
  if (typeof window !== 'undefined') {
    (window as any).__LATTICE_DEVTOOLS__ = {
      enabled: true,
      options,
      getEvents: () => eventBuffer,
      getContexts: () => {
        // Return serializable context info
        const contexts: any[] = [];
        contextMetadata.forEach((meta) => {
          contexts.push({
            id: meta.id,
            name: meta.name,
            signalCount: meta.signals.size,
            computedCount: meta.computeds.size,
            effectCount: meta.effects.size,
          });
        });
        return contexts;
      },
    };
  }

  emitEvent({
    type: 'DEVTOOLS_ENABLED',
    contextId: 'global',
    data: options,
  });
}

export function createInstrumentedLattice(
  name?: string
): LatticeContext & { dispose(): void } {
  const context = originalCreateLattice();
  const contextId = generateId('ctx');

  // Initialize metadata
  contextMetadata.set(context, {
    id: contextId,
    name: name || `Context ${contextId}`,
    signals: new Set(),
    computeds: new Set(),
    effects: new Set(),
  });

  emitEvent({
    type: 'CONTEXT_CREATED',
    contextId,
    data: { name },
  });


  // Wrap signal factory
  const originalSignal = context.signal;
  (context as any).signal = function <T>(
    initialValue: T,
    name?: string
  ): Signal<T> {
    const signal = originalSignal.call(this, initialValue);
    const signalId = generateId('sig');

    const meta = contextMetadata.get(context)!;
    meta.signals.add(signal);

    signalMetadata.set(signal, {
      id: signalId,
      name,
      contextId,
    });


    emitEvent({
      type: 'SIGNAL_CREATED',
      contextId,
      data: {
        id: signalId,
        name,
        initialValue,
      },
    });

    // Wrap signal to track reads/writes
    return new Proxy(signal, {
      get(target, prop) {
        if (prop === 'value') {
          const value = (target as any).value;

          emitEvent({
            type: 'SIGNAL_READ',
            contextId,
            data: {
              id: signalId,
              name,
              value,
              readContext: currentlyExecuting
                ? {
                    type: currentlyExecuting.type,
                    id: currentlyExecuting.id,
                    name: currentlyExecuting.name,
                  }
                : undefined,
              internal: internalOperation,
            },
          });
          return value;
        }
        return (target as any)[prop];
      },
      set(target, prop, value) {
        if (prop === 'value') {
          internalOperation = 'devtools-oldvalue';
          const oldValue = (target as any).value;
          internalOperation = null;

          (target as any).value = value;
          emitEvent({
            type: 'SIGNAL_WRITE',
            contextId,
            data: {
              id: signalId,
              name,
              oldValue,
              newValue: value,
            },
          });
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    }) as Signal<T>;
  };

  // Wrap computed factory
  const originalComputed = context.computed;
  (context as any).computed = function <T>(
    fn: () => T,
    name?: string
  ): Computed<T> {
    const computedId = generateId('comp');

    emitEvent({
      type: 'COMPUTED_CREATED',
      contextId,
      data: {
        id: computedId,
        name,
      },
    });

    // Wrap the compute function to track execution
    const wrappedFn = () => {
      const previouslyExecuting = currentlyExecuting;
      currentlyExecuting = { type: 'computed', id: computedId, name };

      emitEvent({
        type: 'COMPUTED_START',
        contextId,
        data: { id: computedId },
      });

      try {
        const result = fn();

        emitEvent({
          type: 'COMPUTED_END',
          contextId,
          data: {
            id: computedId,
            value: result,
          },
        });

        return result;
      } finally {
        currentlyExecuting = previouslyExecuting;
      }
    };

    const computed = originalComputed.call(this, wrappedFn) as Computed<T>;

    const meta = contextMetadata.get(context)!;
    meta.computeds.add(computed);

    computedMetadata.set(computed, {
      id: computedId,
      name,
      contextId,
      dependencies: new Set(),
    });

    return computed;
  };

  // Wrap effect factory
  const originalEffect = context.effect;
  (context as any).effect = function (
    fn: () => void | (() => void),
    name?: string
  ): () => void {
    const effectId = generateId('eff');

    emitEvent({
      type: 'EFFECT_CREATED',
      contextId,
      data: {
        id: effectId,
        name,
      },
    });

    const wrappedFn = () => {
      const previouslyExecuting = currentlyExecuting;
      currentlyExecuting = { type: 'effect', id: effectId, name };

      emitEvent({
        type: 'EFFECT_START',
        contextId,
        data: { id: effectId },
      });

      try {
        const cleanup = fn();

        emitEvent({
          type: 'EFFECT_END',
          contextId,
          data: { id: effectId },
        });

        return cleanup;
      } finally {
        currentlyExecuting = previouslyExecuting;
      }
    };

    const dispose = originalEffect.call(this, wrappedFn);

    const meta = contextMetadata.get(context)!;
    meta.effects.add(dispose);

    effectMetadata.set(dispose, {
      id: effectId,
      name,
      contextId,
    });

    return dispose;
  };

  // Wrap dispose
  const originalDispose = context.dispose;
  context.dispose = function () {
    emitEvent({
      type: 'CONTEXT_DISPOSED',
      contextId,
    });


    contextMetadata.delete(context);
    return originalDispose.call(this);
  };

  return context;
}

export function createInstrumentedStore<T extends object>(
  initialState: T,
  contextOrName?: LatticeContext | string,
  name?: string
): Store<T> {
  let context: LatticeContext;
  let storeName: string | undefined;

  if (typeof contextOrName === 'string') {
    storeName = contextOrName;
    context = createInstrumentedLattice(storeName);
  } else {
    context = contextOrName || createInstrumentedLattice();
    storeName = name;
  }

  const storeId = generateId('store');
  const contextId = contextMetadata.get(context)?.id || 'unknown';

  // Create signals manually with property names
  const signals = {} as SignalState<T>;
  for (const [key, value] of Object.entries(initialState) as [keyof T, T[keyof T]][]) {
    // Pass the property name as the signal name
    // Use the wrapped signal function that accepts a name
    signals[key] = (context as any).signal(value, `${storeName ? storeName + '.' : ''}${String(key)}`);
  }

  // Implement batched set method
  const set = (updates: Partial<T> | ((current: T) => Partial<T>)) => {
    emitEvent({
      type: 'STORE_UPDATE_START',
      contextId,
      data: {
        id: storeId,
        updates: typeof updates === 'function' ? '<function>' : updates,
      },
    });

    // Mark internal operations during store update
    internalOperation = 'store_update';
    try {
      context.batch(() => {
        // Get current state from all signals
        const current = {} as T;
        for (const [key, signal] of Object.entries(signals) as [keyof T, Signal<T[keyof T]>][]) {
          current[key] = signal.value;
        }

        // Calculate new state
        const newState =
          typeof updates === 'function' ? updates(current) : updates;

        // Update changed signals
        for (const [key, value] of Object.entries(newState) as [keyof T, T[keyof T]][]) {
          if (key in signals) {
            const signal = signals[key];
            if (signal && !Object.is(signal.value, value)) {
              signal.value = value;
            }
          }
        }
      });
    } finally {
      internalOperation = null;
    }

    emitEvent({
      type: 'STORE_UPDATE_END',
      contextId,
      data: {
        id: storeId,
      },
    });
  };

  // Create the store object
  const store: Store<T> = {
    state: signals,
    set,
    getContext: () => context,
    dispose: () => context.dispose(),
  };

  emitEvent({
    type: 'STORE_CREATED',
    contextId,
    data: {
      id: storeId,
      name: storeName,
      initialState,
    },
  });

  return store;
}

// Re-export original functions with instrumentation
export const createLattice = createInstrumentedLattice;
export const createStore = createInstrumentedStore;
