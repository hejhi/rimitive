/**
 * Alternative DevTools middleware that uses internal graph inspection
 * instead of wrapping every operation
 */

import type { LatticeContext } from '@lattice/core';
import type { Signal, Computed, Effect } from '@lattice/signals';
import { initializeDevTools } from './events';
import type { DevToolsOptions } from './types';
import { 
  getSubscribers, 
  getDependencies, 
  getCurrentValue,
  getVersion,
  buildDependencyGraph 
} from './dependency-utils';

// Store references to all reactive primitives created
interface ContextMetadata {
  id: string;
  name: string;
  signals: Set<Signal<unknown>>;
  computeds: Set<Computed<unknown>>;
  effects: Set<Effect>;
}

const contextRegistry = new WeakMap<LatticeContext, ContextMetadata>();
const reactiveRegistry = new WeakMap<Signal<unknown> | Computed<unknown> | Effect, {
  contextId: string;
  name?: string;
  type: 'signal' | 'computed' | 'effect';
}>();

/**
 * Snapshot the current dependency graph state
 */
function snapshotGraph(metadata: ContextMetadata) {
  const snapshot = {
    contextId: metadata.id,
    timestamp: Date.now(),
    signals: [] as Array<{
      id: string;
      name?: string;
      value: unknown;
      version: number;
      subscribers: string[];
    }>,
    computeds: [] as Array<{
      id: string;
      name?: string;
      value: unknown;
      version: number;
      dependencies: string[];
      subscribers: string[];
    }>,
    effects: [] as Array<{
      id: string;
      name?: string;
      dependencies: string[];
    }>,
  };

  // Snapshot signals
  for (const signal of metadata.signals) {
    const meta = reactiveRegistry.get(signal);
    if (!meta) continue;

    snapshot.signals.push({
      id: meta.name || `sig_${snapshot.signals.length}`,
      name: meta.name,
      value: getCurrentValue(signal),
      version: getVersion(signal),
      subscribers: getSubscribers(signal).map(s => s.id),
    });
  }

  // Snapshot computeds
  for (const computed of metadata.computeds) {
    const meta = reactiveRegistry.get(computed);
    if (!meta) continue;

    snapshot.computeds.push({
      id: meta.name || `comp_${snapshot.computeds.length}`,
      name: meta.name,
      value: getCurrentValue(computed),
      version: getVersion(computed),
      dependencies: getDependencies(computed).map(d => d.id),
      subscribers: getSubscribers(computed).map(s => s.id),
    });
  }

  // Snapshot effects
  for (const effect of metadata.effects) {
    const meta = reactiveRegistry.get(effect);
    if (!meta) continue;

    snapshot.effects.push({
      id: meta.name || `eff_${snapshot.effects.length}`,
      name: meta.name,
      dependencies: getDependencies(effect).map(d => d.id),
    });
  }

  return snapshot;
}

/**
 * Creates a lightweight devtools middleware that only tracks graph structure
 */
export function withDevToolsGraph(options: DevToolsOptions = {}) {
  return function instrumentContext(context: LatticeContext): LatticeContext {
    // Initialize devtools if not already done
    initializeDevTools(options);

    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const contextName = options.name || 'LatticeContext';

    const metadata: ContextMetadata = {
      id: contextId,
      name: contextName,
      signals: new Set(),
      computeds: new Set(),
      effects: new Set(),
    };

    contextRegistry.set(context, metadata);

    // Set up periodic graph snapshots
    let snapshotInterval: ReturnType<typeof setInterval> | null = null;
    
    if (options.snapshotInterval !== 0) {
      snapshotInterval = setInterval(() => {
        const snapshot = snapshotGraph(metadata);
        
        // Send snapshot to devtools
        if ((globalThis as any).__LATTICE_DEVTOOLS_API__) {
          (globalThis as any).__LATTICE_DEVTOOLS_API__.sendSnapshot(snapshot);
        }
      }, options.snapshotInterval || 100); // Default 100ms snapshots
    }

    return {
      signal<T>(initialValue: T, name?: string): Signal<T> {
        const signal = context.signal(initialValue);
        
        // Register the signal
        metadata.signals.add(signal);
        reactiveRegistry.set(signal, {
          contextId,
          name,
          type: 'signal',
        });

        // Optionally patch the setter to detect changes
        if (options.trackWrites) {
          const descriptor = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(signal),
            'value'
          );
          
          if (descriptor?.set) {
            const originalSet = descriptor.set;
            const originalGet = descriptor.get;
            
            Object.defineProperty(signal, 'value', {
              get: originalGet,
              set(newValue: T) {
                const result = originalSet.call(this, newValue);
                
                // Trigger immediate snapshot on write
                if (options.snapshotOnWrite) {
                  const snapshot = snapshotGraph(metadata);
                  if ((globalThis as any).__LATTICE_DEVTOOLS_API__) {
                    (globalThis as any).__LATTICE_DEVTOOLS_API__.sendSnapshot(snapshot);
                  }
                }
                
                return result;
              },
              configurable: true,
            });
          }
        }

        return signal;
      },

      computed<T>(fn: () => T, name?: string): Computed<T> {
        const computed = context.computed(fn);
        
        // Register the computed
        metadata.computeds.add(computed);
        reactiveRegistry.set(computed, {
          contextId,
          name,
          type: 'computed',
        });

        return computed;
      },

      effect(fn: () => void | (() => void), name?: string): () => void {
        const dispose = context.effect(fn);
        
        // We need to get the actual effect object
        // This is a bit tricky - we might need to track it differently
        // For now, we'll create a proxy object
        const effectProxy = { dispose, _name: name };
        
        metadata.effects.add(effectProxy as any);
        reactiveRegistry.set(effectProxy as any, {
          contextId,
          name,
          type: 'effect',
        });

        return () => {
          metadata.effects.delete(effectProxy as any);
          dispose();
        };
      },

      batch(fn: () => void): void {
        context.batch(fn);
        
        // After batch, send a snapshot
        if (options.snapshotOnBatch) {
          const snapshot = snapshotGraph(metadata);
          if ((globalThis as any).__LATTICE_DEVTOOLS_API__) {
            (globalThis as any).__LATTICE_DEVTOOLS_API__.sendSnapshot(snapshot);
          }
        }
      },

      dispose() {
        // Clean up
        if (snapshotInterval) {
          clearInterval(snapshotInterval);
        }
        
        metadata.signals.clear();
        metadata.computeds.clear();
        metadata.effects.clear();
        
        context.dispose();
      },
    };
  };
}

/**
 * Get a full dependency graph visualization for all contexts
 */
export function getFullDependencyGraph() {
  const allRoots: Array<Signal<unknown> | Computed<unknown> | Effect> = [];
  
  // This would need access to all contexts - maybe through a global registry
  // For now, this is a placeholder
  
  return buildDependencyGraph(allRoots);
}