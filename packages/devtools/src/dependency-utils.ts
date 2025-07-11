/**
 * Utilities for extracting dependency information from Lattice primitives
 * 
 * This module provides access to the internal dependency graph maintained
 * by Lattice's reactive system.
 */

import type { Signal, Computed, Effect } from '@lattice/signals';

// Internal type definitions based on Lattice's implementation
// These match the actual internal structure of SignalImpl, ComputedImpl, and EffectImpl

interface DependencyNode {
  source: Signal<unknown> | Computed<unknown>;
  target: Computed<unknown> | Effect;
  prevSource?: DependencyNode;
  nextSource?: DependencyNode;
  prevTarget?: DependencyNode;
  nextTarget?: DependencyNode;
  version: number;
  rollbackNode?: DependencyNode;
}

interface SignalImpl<T = unknown> extends Signal<T> {
  _value: T;
  _version: number;
  _targets?: DependencyNode;
  _node?: DependencyNode;
}

interface ComputedImpl<T = unknown> extends Computed<T> {
  _fn: () => T;
  _value: T | undefined;
  _version: number;
  _globalVersion: number;
  _flags: number;
  _sources?: DependencyNode;
  _targets?: DependencyNode;
  _node?: DependencyNode;
}

interface EffectImpl extends Effect {
  _fn: () => void | (() => void);
  _flags: number;
  _sources?: DependencyNode;
  _nextBatchedEffect?: Effect;
}

// Flags used internally by Lattice
const OUTDATED = 1 << 1;
const RUNNING = 1 << 2;
const DISPOSED = 1 << 3;

export interface DependencyInfo {
  id: string;
  type: 'signal' | 'computed' | 'effect';
  name?: string;
  value?: unknown;
  isActive?: boolean;
}

/**
 * Get all subscribers (effects/computeds) that depend on a signal/computed
 */
export function getSubscribers(source: Signal<unknown> | Computed<unknown>): DependencyInfo[] {
  const subscribers: DependencyInfo[] = [];
  const impl = source as SignalImpl | ComputedImpl;
  
  let node = impl._targets;
  while (node) {
    const target = node.target;
    const targetImpl = target as ComputedImpl | EffectImpl;
    
    subscribers.push({
      id: getReactiveId(target),
      type: isComputed(target) ? 'computed' : 'effect',
      name: getReactiveName(target),
      isActive: (targetImpl._flags & DISPOSED) === 0,
    });
    
    node = node.nextTarget;
  }
  
  return subscribers;
}

/**
 * Get all dependencies (signals/computeds) that an effect/computed depends on
 */
export function getDependencies(target: Computed<unknown> | Effect): DependencyInfo[] {
  const dependencies: DependencyInfo[] = [];
  const impl = target as ComputedImpl | EffectImpl;
  
  let node = impl._sources;
  while (node) {
    const source = node.source;
    
    dependencies.push({
      id: getReactiveId(source),
      type: isSignal(source) ? 'signal' : 'computed',
      name: getReactiveName(source),
      value: getCurrentValue(source),
    });
    
    node = node.nextSource;
  }
  
  return dependencies;
}

/**
 * Check if a computed or effect is currently executing
 */
export function isRunning(target: Computed<unknown> | Effect): boolean {
  const impl = target as ComputedImpl | EffectImpl;
  return (impl._flags & RUNNING) !== 0;
}

/**
 * Check if a computed is outdated and needs recomputation
 */
export function isOutdated(computed: Computed<unknown>): boolean {
  const impl = computed as ComputedImpl;
  return (impl._flags & OUTDATED) !== 0;
}

/**
 * Check if a signal/computed has any active subscribers
 */
export function hasSubscribers(source: Signal<unknown> | Computed<unknown>): boolean {
  const impl = source as SignalImpl | ComputedImpl;
  return impl._targets !== undefined;
}

/**
 * Get the current value of a signal or computed (without triggering dependencies)
 */
export function getCurrentValue(source: Signal<unknown> | Computed<unknown>): unknown {
  const impl = source as SignalImpl | ComputedImpl;
  return impl._value;
}

/**
 * Get the version number of a signal or computed
 */
export function getVersion(source: Signal<unknown> | Computed<unknown>): number {
  const impl = source as SignalImpl | ComputedImpl;
  return impl._version;
}

// WeakMap to store consistent IDs for reactive primitives
const reactiveIds = new WeakMap<object, string>();
let idCounter = 0;

/**
 * Get or generate a consistent ID for a reactive primitive
 */
function getReactiveId(reactive: Signal<unknown> | Computed<unknown> | Effect): string {
  let id = reactiveIds.get(reactive);
  if (!id) {
    const type = isSignal(reactive) ? 'sig' : isComputed(reactive) ? 'comp' : 'eff';
    id = `${type}_${++idCounter}`;
    reactiveIds.set(reactive, id);
  }
  return id;
}

/**
 * Extract the name of a reactive primitive if it was provided
 */
function getReactiveName(reactive: Signal<unknown> | Computed<unknown> | Effect): string | undefined {
  // Names might be stored in various ways depending on how they're created
  // Check common patterns used in Lattice
  const impl = reactive as any;
  
  // Direct name property
  if (impl._name) return impl._name;
  
  // Name might be stored in metadata
  if (impl._meta?.name) return impl._meta.name;
  
  // For store signals, the name might be the property key
  if (impl._key) return impl._key;
  
  return undefined;
}

/**
 * Type guards with proper internal checks
 */
function isSignal(value: unknown): value is Signal<unknown> {
  if (!value || typeof value !== 'object') return false;
  const impl = value as SignalImpl;
  
  // Signals have _value and _version but not _fn
  return '_value' in impl && 
         '_version' in impl && 
         !('_fn' in impl);
}

function isComputed(value: unknown): value is Computed<unknown> {
  if (!value || typeof value !== 'object') return false;
  const impl = value as ComputedImpl;
  
  // Computeds have _fn, _value, and _flags
  return '_fn' in impl && 
         '_value' in impl && 
         '_flags' in impl;
}

// Note: isEffect is not currently used but kept for completeness
// function isEffect(value: unknown): value is Effect {
//   if (!value || typeof value !== 'object') return false;
//   const impl = value as EffectImpl;
//   
//   // Effects have _fn and _flags but not _value
//   return '_fn' in impl && 
//          '_flags' in impl && 
//          !('_value' in impl);
// }

/**
 * Build a complete dependency graph for visualization
 */
export interface DependencyGraphNode {
  id: string;
  type: 'signal' | 'computed' | 'effect';
  name?: string;
  value?: unknown;
  isActive: boolean;
  isOutdated?: boolean;
  hasSubscribers?: boolean;
}

export interface DependencyGraphEdge {
  source: string;
  target: string;
  isActive: boolean;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyGraphNode>;
  edges: DependencyGraphEdge[];
}

/**
 * Build a dependency graph starting from a set of reactive primitives
 */
export function buildDependencyGraph(
  roots: Array<Signal<unknown> | Computed<unknown> | Effect>
): DependencyGraph {
  const nodes = new Map<string, DependencyGraphNode>();
  const edges: DependencyGraphEdge[] = [];
  const visited = new WeakSet<object>();
  
  // Helper to add a node to the graph
  function addNode(reactive: Signal<unknown> | Computed<unknown> | Effect) {
    if (visited.has(reactive)) return;
    visited.add(reactive);
    
    const id = getReactiveId(reactive);
    const type = isSignal(reactive) ? 'signal' : isComputed(reactive) ? 'computed' : 'effect';
    
    const node: DependencyGraphNode = {
      id,
      type,
      name: getReactiveName(reactive),
      isActive: true,
    };
    
    if (type === 'signal' || type === 'computed') {
      node.value = getCurrentValue(reactive as Signal<unknown> | Computed<unknown>);
      node.hasSubscribers = hasSubscribers(reactive as Signal<unknown> | Computed<unknown>);
    }
    
    if (type === 'computed') {
      node.isOutdated = isOutdated(reactive as Computed<unknown>);
    }
    
    nodes.set(id, node);
    
    // Add edges and traverse dependencies
    if (type === 'computed' || type === 'effect') {
      const deps = getDependencies(reactive as Computed<unknown> | Effect);
      for (const dep of deps) {
        edges.push({
          source: dep.id,
          target: id,
          isActive: dep.isActive !== false,
        });
      }
    }
    
    // Add edges and traverse subscribers
    if (type === 'signal' || type === 'computed') {
      const subs = getSubscribers(reactive as Signal<unknown> | Computed<unknown>);
      for (const sub of subs) {
        edges.push({
          source: id,
          target: sub.id,
          isActive: sub.isActive !== false,
        });
      }
    }
  }
  
  // Start traversal from roots
  for (const root of roots) {
    addNode(root);
  }
  
  return { nodes, edges };
}