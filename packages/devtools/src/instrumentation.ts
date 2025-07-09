import type { LatticeContext, Store } from '@lattice/core';
import type { Signal, Computed } from '@lattice/signals';
import { createLattice as originalCreateLattice, createStore as originalCreateStore } from '@lattice/core';

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
const contextMetadata = new Map<LatticeContext, {
  id: string;
  name: string;
  signals: Set<any>;
  computeds: Set<any>;
  effects: Set<() => void>;
}>();

// Track signal/computed metadata
const signalMetadata = new WeakMap<any, {
  id: string;
  name?: string;
  contextId: string;
}>();

const computedMetadata = new WeakMap<any, {
  id: string;
  name?: string;
  contextId: string;
  dependencies: Set<any>;
}>();

function emitEvent(event: Omit<DevToolsEvent, 'timestamp'>) {
  if (!devToolsEnabled) return;
  
  const fullEvent = { ...event, timestamp: Date.now() };
  eventBuffer.push(fullEvent);
  
  // Keep buffer size under control
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer = eventBuffer.slice(-MAX_BUFFER_SIZE / 2);
  }
  
  // Send to devtools if connected
  if (typeof window !== 'undefined' && (window as any).__LATTICE_DEVTOOLS_BRIDGE__) {
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

export function createInstrumentedLattice(name?: string): LatticeContext & { dispose(): void } {
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
  (context as any).signal = function<T>(initialValue: T, name?: string): Signal<T> {
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
              value,
            },
          });
          return value;
        }
        return (target as any)[prop];
      },
      set(target, prop, value) {
        if (prop === 'value') {
          const oldValue = (target as any).value;
          (target as any).value = value;
          emitEvent({
            type: 'SIGNAL_WRITE',
            contextId,
            data: {
              id: signalId,
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
  (context as any).computed = function<T>(fn: () => T, name?: string): Computed<T> {
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
      emitEvent({
        type: 'COMPUTED_START',
        contextId,
        data: { id: computedId },
      });
      
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
  (context as any).effect = function(fn: () => void | (() => void), name?: string): () => void {
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
      emitEvent({
        type: 'EFFECT_START',
        contextId,
        data: { id: effectId },
      });
      
      const cleanup = fn();
      
      emitEvent({
        type: 'EFFECT_END',
        contextId,
        data: { id: effectId },
      });
      
      return cleanup;
    };
    
    const dispose = originalEffect.call(this, wrappedFn);
    
    const meta = contextMetadata.get(context)!;
    meta.effects.add(dispose);
    
    return dispose;
  };
  
  // Wrap dispose
  const originalDispose = context.dispose;
  context.dispose = function() {
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
  
  const store = originalCreateStore(initialState, context);
  const storeId = generateId('store');
  const contextId = contextMetadata.get(context)?.id || 'unknown';
  
  emitEvent({
    type: 'STORE_CREATED',
    contextId,
    data: {
      id: storeId,
      name: storeName,
      initialState,
    },
  });
  
  // Wrap set method
  const originalSet = store.set;
  store.set = function(updates: Partial<T> | ((current: T) => Partial<T>)) {
    emitEvent({
      type: 'STORE_UPDATE_START',
      contextId,
      data: {
        id: storeId,
        updates: typeof updates === 'function' ? '<function>' : updates,
      },
    });
    
    originalSet.call(this, updates);
    
    emitEvent({
      type: 'STORE_UPDATE_END',
      contextId,
      data: {
        id: storeId,
      },
    });
  };
  
  return store;
}

// Re-export original functions with instrumentation
export const createLattice = createInstrumentedLattice;
export const createStore = createInstrumentedStore;