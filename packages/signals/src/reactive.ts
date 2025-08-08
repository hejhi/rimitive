/**
 * ALGORITHM: Proxy-Based Fine-Grained Reactivity
 * 
 * This module provides an alternative to signals for fine-grained reactivity using ES6 Proxies.
 * Unlike signals which track whole objects, reactive proxies track individual property paths.
 * 
 * Key concepts:
 * 1. PATH-BASED TRACKING: Each property path (e.g., "user.settings.theme") is tracked separately
 * 2. LAZY PROXY CREATION: Nested objects are only proxied when accessed
 * 3. SEAMLESS INTEGRATION: Works with existing effect/computed/subscribe primitives
 * 4. NATURAL SYNTAX: Use regular JavaScript property access and assignment
 * 
 * Trade-offs vs Signals:
 * + Natural JavaScript syntax (no .value)
 * + Fine-grained updates (only specific paths trigger updates)
 * + Dynamic property addition
 * - Proxy overhead and less predictable performance
 * - Harder to debug (proxy magic)
 * - Not compatible with primitive values
 */

import { CONSTANTS } from './constants';
import type { ProducerNode, ConsumerNode, Edge, ScheduledNode } from './types';
import type { ExtendedSignalContext } from './api';
import { createDependencyHelpers } from './helpers/dependency-tracking';
import { createGraphWalker } from './helpers/graph-walker';
import type { LatticeExtension } from '@lattice/lattice';

const { RUNNING } = CONSTANTS;

// Symbol to identify reactive objects
const REACTIVE_FLAG = Symbol('__reactive__');

// Symbol to access the raw object without proxy interception
const RAW = Symbol('__raw__');

// Type guard to check if an object has the reactive flag
function hasReactiveFlag(value: unknown): value is ReactiveInterface {
  return value !== null && 
    typeof value === 'object' && 
    REACTIVE_FLAG in value &&
    value[REACTIVE_FLAG] === true;
}

interface PathNode extends ProducerNode {
  __type: 'reactive-path';
  _path: string;
  _targets: Edge | undefined;
  _version: number;
}

// OPTIMIZATION: Path String Interning
// Reuse identical path strings to reduce memory usage
const pathStringCache = new Map<string, string>();
function internPath(path: string): string {
  const cached = pathStringCache.get(path);
  if (cached) return cached;
  pathStringCache.set(path, path);
  return path;
}

// OPTIMIZATION: WeakMap-based nested proxy tracking
// Allows automatic GC when objects are no longer referenced
interface ProxyTracker {
  proxies: WeakMap<object, ReactiveInterface<ReactiveTarget>>;
}

interface ReactiveState<T extends ReactiveTarget = ReactiveTarget> {
  // Track version per path for fine-grained updates
  pathVersions: Map<string, number>;
  // Track PathNode per path for dependency graph
  pathNodes: Map<string, PathNode>;
  // Reference to the root proxy for nested proxy creation
  rootProxy: ReactiveInterface<ReactiveTarget>;
  // Original target object
  target: T;
  // WeakMap for nested proxies - allows GC when nested objects are unreachable
  nestedProxies: WeakMap<object, ProxyTracker>;
  // Track active consumer count per path for immediate cleanup
  pathConsumerCounts: Map<string, number>;
}

// WeakMap to store reactive state for each proxy
const reactiveStates = new WeakMap<object, ReactiveState>();


// Set of constructor names that should not be proxied
const UNPROXIABLE_TYPES = new Set([
  'Date',
  'RegExp',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Error',
  'Promise',
  'ArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array'
]);

// Check if an object can be proxied
function canProxy(value: unknown): value is ReactiveTarget {
  if (value === null || typeof value !== 'object') return false;
  
  // Check constructor name for built-in types
  const ctor = value.constructor;
  if (ctor && UNPROXIABLE_TYPES.has(ctor.name)) return false;
  
  // Check if it's a DOM node
  if (typeof Node !== 'undefined' && value instanceof Node) return false;
  
  // Check if object is extensible (not frozen/sealed)
  if (!Object.isExtensible(value)) return false;
  
  return true;
}

// Type for objects that can be made reactive
type ReactiveTarget = object;


// For better type inference, we need to handle assignment differently
export type ReactiveInterface<T extends ReactiveTarget = ReactiveTarget> = T & {
  [REACTIVE_FLAG]: true;
  [RAW]: T;
};

export function createReactiveFactory(ctx: ExtendedSignalContext): LatticeExtension<'reactive', ReactiveMethod> {
  const graphWalker = createGraphWalker();
  const depHelpers = createDependencyHelpers();
  const { workQueue: { enqueue } } = ctx;
  
  // Track all reactive states for cleanup
  const allReactiveStates = new Set<ReactiveState>();
  
  // OPTIMIZATION: Hook into edge removal for immediate cleanup
  const originalRemoveFromTargets = depHelpers.removeFromTargets;
  depHelpers.removeFromTargets = function(edge: Edge) {
    originalRemoveFromTargets(edge);
    
    // Check if this was a PathNode edge
    const source = edge.source;
    if (source && '__type' in source && source.__type === 'reactive-path') {
      const pathNode = source as PathNode;
      
      // If no more targets, mark for immediate cleanup
      if (!pathNode._targets) {
        // Find the state that owns this PathNode
        for (const state of allReactiveStates) {
          if (state.pathNodes.get(pathNode._path) === pathNode) {
            // Immediate cleanup - no consumers left
            state.pathNodes.delete(pathNode._path);
            state.pathVersions.delete(pathNode._path);
            state.pathConsumerCounts.delete(pathNode._path);
            break;
          }
        }
      }
    }
  };
  
  // MEMORY LIMITS: Configurable path limit to prevent unbounded growth
  let maxPathsPerState = 10000; // Default limit
  
  // OPTIMIZATION: Pre-defined notification handler for hot path
  const notifyNode = (node: ConsumerNode): void => {
    if ('_nextScheduled' in node) enqueue(node as ScheduledNode);
  };
  
  function createPathNode(path: string): PathNode {
    return {
      __type: 'reactive-path' as const,
      _path: internPath(path), // Use interned string
      _version: 0,
      _targets: undefined,
    };
  }
  
  function trackDependency(state: ReactiveState, path: string): void {
    // Only track if we're inside a running computed/effect
    const consumer = ctx.currentConsumer;
    if (!consumer || !(consumer._flags & RUNNING)) return;
    
    // Intern the path for memory efficiency
    const internedPath = internPath(path);
    
    // Get or create PathNode for this path
    let pathNode = state.pathNodes.get(internedPath);
    if (!pathNode) {
      // Check memory limit before creating new path
      if (state.pathNodes.size >= maxPathsPerState) {
        console.warn(`[reactive] Path limit reached (${maxPathsPerState}). Consider increasing limit or reviewing usage.`);
        return; // Don't track this dependency
      }
      
      pathNode = createPathNode(internedPath);
      state.pathNodes.set(internedPath, pathNode);
      state.pathVersions.set(internedPath, 0);
      state.pathConsumerCounts.set(internedPath, 0);
    }
    
    // Track if this is a new consumer for this path
    const hadTargets = !!pathNode._targets;
    
    // Get current version for this path
    const version = state.pathVersions.get(internedPath) || 0;
    pathNode._version = version;
    
    // Use existing dependency helpers for consistency
    depHelpers.addDependency(pathNode, consumer, version);
    
    // Update consumer count if we added a new consumer
    if (!hadTargets && pathNode._targets) {
      state.pathConsumerCounts.set(internedPath, 1);
    } else if (pathNode._targets && !hadTargets) {
      const count = state.pathConsumerCounts.get(internedPath) || 0;
      state.pathConsumerCounts.set(internedPath, count + 1);
    }
  }
  
  
  function notifyPath(state: ReactiveState, path: string): void {
    const internedPath = internPath(path);
    const pathNode = state.pathNodes.get(internedPath);
    if (!pathNode || !pathNode._targets) return;
    
    // Increment version for this path
    const newVersion = (state.pathVersions.get(internedPath) || 0) + 1;
    state.pathVersions.set(internedPath, newVersion);
    pathNode._version = newVersion;
    
    // Increment global version to trigger computed checks
    ctx.version++;
    
    // Check if we're in a batch
    const isNewBatch = ctx.batchDepth === 0;
    if (isNewBatch) ctx.batchDepth++;
    
    // Walk the dependency graph starting from this path's targets
    graphWalker.walk(pathNode._targets, notifyNode);
    
    // Flush if we created the batch
    if (isNewBatch && --ctx.batchDepth === 0) {
      ctx.workQueue.flush();
    }
  }
  
  function createReactiveProxy<T extends ReactiveTarget>(
    target: T,
    state: ReactiveState,
    path: string = ''
  ): ReactiveInterface<T> {
    try {
    // Get or create proxy tracker for this object
    let proxyTracker = state.nestedProxies.get(target);
    if (!proxyTracker) {
      proxyTracker = { proxies: new WeakMap() };
      state.nestedProxies.set(target, proxyTracker);
    }
    
    const proxy = new Proxy(target, {
      get(obj: T, prop: string | symbol): unknown {
        // Special symbols
        if (prop === REACTIVE_FLAG) return true;
        if (prop === RAW) return obj;
        
        // Convert symbol to string for path tracking
        const propKey = String(prop);
        const fullPath = path ? `${path}.${propKey}` : propKey;
        
        // Track dependency
        trackDependency(state, fullPath);
        
        const value = Reflect.get(obj, prop);
        
        // Create proxy for nested objects
        if (canProxy(value) && !hasReactiveFlag(value)) {
          // Check WeakMap cache first
          const cachedProxy = proxyTracker.proxies.get(value);
          if (cachedProxy) return cachedProxy;
          
          // Check if this is a circular reference back to root
          if (value === state.target) {
            return state.rootProxy;
          }
          
          // Check if we've already proxied this object elsewhere in the tree
          const existingState = reactiveStates.get(value);
          if (existingState && existingState === state) {
            // Same reactive state - it's a circular reference
            return state.rootProxy;
          }
          
          const nestedProxy = createReactiveProxy(value as ReactiveTarget, state, fullPath);
          proxyTracker.proxies.set(value, nestedProxy);
          return nestedProxy;
        }
        
        return value;
      },
      
      set(obj: T, prop: string | symbol, value: unknown): boolean {
        const propKey = String(prop);
        const fullPath = path ? `${path}.${propKey}` : propKey;
        
        // PRODUCTION FIX: Handle property descriptors correctly
        // Must respect proxy invariants for non-configurable properties
        const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        
        if (descriptor && !descriptor.configurable) {
          // For non-configurable properties, we must follow strict rules
          if ('value' in descriptor && !descriptor.writable) {
            // Non-writable data property
            // Proxy invariant: must return same success as Reflect.set
            if (!Object.is(descriptor.value, value)) {
              // Different value - Reflect.set would return false
              return false;
            }
            // Same value - can return true
            return true;
          }
          
          if ('get' in descriptor && !('set' in descriptor)) {
            // Getter without setter on non-configurable property
            // Reflect.set would return false
            return false;
          }
        }
        
        // Get old value for comparison
        const oldValue = Reflect.get(obj, prop);
        
        // Skip if value hasn't changed (optimization)
        if (Object.is(oldValue, value)) return true;
        
        // Check if this is a new property
        const isNewProperty = !(prop in obj);
        
        // Attempt to set the value
        // For normal properties, this should always succeed
        let result: boolean;
        try {
          result = Reflect.set(obj, prop, value);
        } catch (error) {
          // Some exotic objects might throw during set
          // We return true to avoid proxy TypeError
          return true;
        }
        
        // If set failed, we still return true to avoid proxy TypeError
        if (!result) return true;
        
        // IMPORTANT: Only perform side effects if set succeeded
        // This ensures consistency between proxy state and actual object
        
        // Clear cached proxy if the old value was proxyable
        if (canProxy(oldValue)) {
          proxyTracker.proxies.delete(oldValue);
        }
        
        // Notify dependents of this path
        notifyPath(state, fullPath);
        
        // Notify about key changes if we added a new property
        if (isNewProperty) {
          const keysPath = path ? `${path}.__keys__` : '__keys__';
          notifyPath(state, keysPath);
        }
        
        return true;
      },
      
      has(obj: T, prop: string | symbol): boolean {
        const propKey = String(prop);
        const fullPath = path ? `${path}.${propKey}` : propKey;
        trackDependency(state, fullPath);
        return prop in obj;
      },
      
      ownKeys(obj: T): (string | symbol)[] {
        // Track access to the object's keys
        trackDependency(state, path || '__keys__');
        return Reflect.ownKeys(obj);
      },
      
      deleteProperty(obj: T, prop: string | symbol): boolean {
        const propKey = String(prop);
        const fullPath = path ? `${path}.${propKey}` : propKey;
        
        // Check if property is configurable
        const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        if (descriptor && !descriptor.configurable) {
          // Cannot delete non-configurable property - let Reflect handle the error
          return Reflect.deleteProperty(obj, prop);
        }
        
        // Clear cached proxy for deleted property
        const deletedValue = Reflect.get(obj, prop);
        if (canProxy(deletedValue)) {
          proxyTracker.proxies.delete(deletedValue);
        }
        
        const result = Reflect.deleteProperty(obj, prop);
        
        if (result) {
          notifyPath(state, fullPath);
          // Notify parent for key changes
          notifyPath(state, path || '__keys__');
        }
        
        return result;
      }
    });
    
    return proxy as ReactiveInterface<T>;
    } finally {
      // No cleanup needed
    }
  }
  
  function reactive<T extends ReactiveTarget>(target: T): ReactiveInterface<T> {
    // Validate input
    if (!canProxy(target)) {
      throw new TypeError('Target cannot be made reactive. Only plain objects and arrays are supported.');
    }
    
    // Return existing proxy if already reactive
    if (hasReactiveFlag(target)) {
      return target as ReactiveInterface<T>;
    }
    
    // Check if we already have a proxy for this object
    const existingState = reactiveStates.get(target);
    if (existingState) {
      return existingState.rootProxy as ReactiveInterface<T>;
    }
    
    // Create reactive state with temporary null proxy
    const state: ReactiveState<T> = {
      pathVersions: new Map<string, number>(),
      pathNodes: new Map<string, PathNode>(),
      rootProxy: null as unknown as ReactiveInterface<ReactiveTarget>,
      target,
      nestedProxies: new WeakMap(),
      pathConsumerCounts: new Map<string, number>(),
    };
    
    // Create the root proxy
    const proxy = createReactiveProxy(target, state);
    state.rootProxy = proxy as ReactiveInterface<ReactiveTarget>;
    
    // Store state for later access
    reactiveStates.set(target, state as ReactiveState);
    reactiveStates.set(proxy, state as ReactiveState);
    allReactiveStates.add(state as ReactiveState);
    
    // No per-state disposal needed - handled globally
    
    return proxy;
  }
  
  // Periodic cleanup function to remove unused PathNodes
  function cleanupUnusedPaths(): void {
    for (const state of allReactiveStates) {
      const unusedPaths = new Set<string>();
      
      // Find PathNodes with no targets (no dependencies)
      for (const [path, pathNode] of state.pathNodes) {
        if (!pathNode._targets) {
          unusedPaths.add(path);
        }
      }
      
      // Remove unused PathNodes
      for (const path of unusedPaths) {
        state.pathNodes.delete(path);
        state.pathVersions.delete(path);
      }
    }
  }
  
  // Get memory usage metrics
  function getMemoryMetrics(): ReactiveMemoryMetrics {
    let totalPaths = 0;
    for (const state of allReactiveStates) {
      totalPaths += state.pathNodes.size;
    }
    
    return {
      totalPaths,
      totalStates: allReactiveStates.size,
      pathStringCacheSize: pathStringCache.size,
      internedStrings: pathStringCache.size,
    };
  }
  
  // Set path limit
  function setPathLimit(limit: number): void {
    if (limit < 100) {
      throw new Error('Path limit must be at least 100');
    }
    maxPathsPerState = limit;
  }
  
  // Store cleanup function on the returned extension for proper access
  const reactiveWithCleanup = Object.assign(reactive, {
    cleanupUnusedPaths,
    getMemoryMetrics,
    setPathLimit,
  });
  
  // Set up periodic cleanup (every 60 seconds)
  let cleanupInterval: ReturnType<typeof setInterval> | undefined;
  if (typeof setInterval !== 'undefined') {
    cleanupInterval = setInterval(cleanupUnusedPaths, 60000);
  }
  
  return {
    name: 'reactive',
    method: reactiveWithCleanup,
    onDispose: () => {
      // Clear interval on disposal
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
      
      // Dispose all reactive states  
      for (const state of allReactiveStates) {
        // Clean up all PathNodes
        for (const pathNode of state.pathNodes.values()) {
          // Remove all edges from this PathNode
          let edge = pathNode._targets;
          while (edge) {
            const next = edge.nextTarget;
            depHelpers.removeFromTargets(edge);
            edge = next;
          }
        }
        
        // Clear maps to release memory
        state.pathNodes.clear();
        state.pathVersions.clear();
        
        // Remove from tracking
        reactiveStates.delete(state.target);
        reactiveStates.delete(state.rootProxy);
      }
      allReactiveStates.clear();
    }
  };
}

// Type exports
export type Reactive<T extends ReactiveTarget = ReactiveTarget> = ReactiveInterface<T>;

// Memory usage metrics
export interface ReactiveMemoryMetrics {
  totalPaths: number;
  totalStates: number;
  pathStringCacheSize: number;
  internedStrings: number;
}

// Extended reactive method type with cleanup and metrics
export interface ReactiveMethod {
  <T extends ReactiveTarget>(target: T): ReactiveInterface<T>;
  cleanupUnusedPaths(): void;
  getMemoryMetrics(): ReactiveMemoryMetrics;
  setPathLimit(limit: number): void;
}