/**
 * Utilities for extracting dependency information from Lattice primitives
 * 
 * This module provides access to the internal dependency graph maintained
 * by Lattice's reactive system.
 */

import type { Signal, Computed, Effect } from '@lattice/core';
import type { SignalImpl, ComputedImpl, EffectImpl } from './internal-types';
import { isDisposed, isRunning as isRunningHelper, isOutdated as isOutdatedHelper } from './internal-types';
import { isSignal, isComputed } from './type-guards';

export interface DependencyInfo {
  id: string;
  type: 'signal' | 'computed' | 'effect';
  name?: string;
  value?: unknown;
  isActive?: boolean;
  ref?: Signal<unknown> | Computed<unknown> | Effect;
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
      isActive: !isDisposed(targetImpl),
      ref: target,
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
      ref: source,
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
  return isRunningHelper(impl);
}

/**
 * Check if a computed is outdated and needs recomputation
 */
export function isOutdated(computed: Computed<unknown>): boolean {
  const impl = computed as ComputedImpl;
  return isOutdatedHelper(impl);
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
  const impl = reactive as unknown as Record<string, unknown>;
  
  // Direct name property
  if ('_name' in impl && typeof impl._name === 'string') {
    return impl._name;
  }
  
  // Name might be stored in metadata
  if ('_meta' in impl && 
      impl._meta && 
      typeof impl._meta === 'object' &&
      'name' in impl._meta) {
    const meta = impl._meta as Record<string, unknown>;
    if (typeof meta.name === 'string') {
      return meta.name;
    }
  }
  
  // For store signals, the name might be the property key
  if ('_key' in impl && typeof impl._key === 'string') {
    return impl._key;
  }
  
  return undefined;
}


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