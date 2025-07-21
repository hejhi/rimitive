// Simplified Signal implementation - bare metal

import type { DependencyNode } from './types';
import type { Signal as SignalInterface, Computed, Effect } from './types';
import type { Selected } from './select';
import { RUNNING } from './types';

// Context for tracking state
interface SignalContext {
  currentComputed: Computed | Effect | null;
  version: number;
  batchDepth: number;
  batchedEffects: Effect | null;
  // Node pool state
  nodePool: DependencyNode[];
  poolSize: number;
  allocations: number;
  poolHits: number;
  poolMisses: number;
}

// Pool configuration
const MAX_POOL_SIZE = 1000;
const INITIAL_POOL_SIZE = 100;

// Initialize a node pool
function initializeNodePool(): DependencyNode[] {
  const pool = new Array(INITIAL_POOL_SIZE) as DependencyNode[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    pool[i] = {} as DependencyNode;
  }
  return pool;
}

// Active context - direct mutation for performance
let activeContext: SignalContext = {
  currentComputed: null,
  version: 0,
  batchDepth: 0,
  batchedEffects: null,
  nodePool: initializeNodePool(),
  poolSize: INITIAL_POOL_SIZE,
  allocations: 0,
  poolHits: 0,
  poolMisses: 0,
};

// Direct class syntax - cleaner and more idiomatic
class Signal<T> implements SignalInterface<T> {
  __type = 'signal' as const;
  _value: T;
  _version = 0;
  _targets: DependencyNode | undefined = undefined;
  _node: DependencyNode | undefined = undefined;

  constructor(value: T) {
    this._value = value;
  }

  declare subscribe: (listener: () => void) => () => void;
  declare select: <R>(selector: (value: T) => R) => Selected<R>;

  // Value property - moved to class for consistency
  get value(): T {
    // Fast path: no tracking needed
    if (
      !activeContext.currentComputed ||
      !(activeContext.currentComputed._flags & RUNNING)
    )
      return this._value;

    const current = activeContext.currentComputed;

    // Node reuse pattern - check if we can reuse existing node
    let node = this._node;
    if (node !== undefined && node.target === current) {
      // Reuse existing node - just update version
      node.version = this._version;
      return this._value;
    }

    // Check if already tracking this signal in current computed
    node = current._sources;
    while (node) {
      if (node.source === this) {
        node.version = this._version;
        return this._value;
      }
      node = node.nextSource;
    }

    // Create new dependency node using context pool
    activeContext.allocations++;
    const newNode =
      activeContext.poolSize > 0
        ? (activeContext.poolHits++,
          activeContext.nodePool[--activeContext.poolSize]!)
        : (activeContext.poolMisses++, {} as DependencyNode);
    newNode.source = this;
    newNode.target = current;
    newNode.version = this._version;
    newNode.nextSource = current._sources;
    newNode.nextTarget = this._targets;
    newNode.prevSource = undefined;
    newNode.prevTarget = undefined;

    if (current._sources) {
      current._sources.prevSource = newNode;
    }
    current._sources = newNode;

    if (this._targets) {
      this._targets.prevTarget = newNode;
    }
    this._targets = newNode;

    // Store node for reuse
    this._node = newNode;

    return this._value;
  }

  set value(value: T) {
    if (this._value === value) return;

    this._value = value;
    this._version++;
    activeContext.version++;

    // Notify all targets
    let node = this._targets;
    while (node) {
      node.target._notify();
      node = node.nextTarget;
    }
  }

  // Signals are always fresh
  _refresh(): boolean {
    return true;
  }

  // Set method for updating nested values
  set(key: unknown, value: unknown): void {
    if (Array.isArray(this._value)) {
      // For arrays, create new array with updated element
      const arr = [...this._value];
      const index = key as number;
      arr[index] = value;
      this.value = arr as T;
    } else if (typeof this._value === 'object' && this._value !== null) {
      // For objects, use spread
      const objKey = key as keyof T;
      this.value = { ...this._value, [objKey]: value } as T;
    }
  }

  // Patch method for partial updates
  patch(key: unknown, partial: unknown): void {
    if (Array.isArray(this._value)) {
      // For arrays, patch element at index
      const arr = [...this._value];
      const index = key as number;
      const current = arr[index];
      arr[index] =
        typeof current === 'object' && current !== null
          ? { ...current, ...(partial as object) }
          : partial;
      this.value = arr as T;
    } else if (typeof this._value === 'object' && this._value !== null) {
      // For objects, patch property
      const objKey = key as keyof T;
      const current = this._value[objKey];
      this.value = {
        ...this._value,
        [objKey]:
          typeof current === 'object' && current !== null
            ? { ...current, ...(partial as object) }
            : partial,
      } as T;
    }
  }

  // Peek method - read value without tracking
  peek(): T {
    return this._value;
  };
}

// Additional prototype methods (subscribe, select) are added in index.ts

// Direct exports instead of factory pattern
export function signal<T>(value: T): SignalInterface<T> {
  return new Signal(value);
}

export function untrack<T>(fn: () => T): T {
  const prev = activeContext.currentComputed;
  activeContext.currentComputed = null;
  try {
    return fn();
  } finally {
    activeContext.currentComputed = prev;
  }
}

// Export activeContext for direct access
export { activeContext };

// Context management
export function withContext<T>(fn: () => T): T {
  const prevContext = activeContext;
  activeContext = {
    currentComputed: null,
    version: prevContext.version, // Preserve version across contexts
    batchDepth: 0,
    batchedEffects: null,
    nodePool: initializeNodePool(),
    poolSize: INITIAL_POOL_SIZE,
    allocations: 0,
    poolHits: 0,
    poolMisses: 0,
  };

  try {
    return fn();
  } finally {
    activeContext = prevContext;
  }
}

export function resetTracking(): void {
  activeContext.currentComputed = null;
  activeContext.version = 0;
  activeContext.batchDepth = 0;
  activeContext.batchedEffects = null;
  activeContext.nodePool = initializeNodePool();
  activeContext.poolSize = INITIAL_POOL_SIZE;
  activeContext.allocations = 0;
  activeContext.poolHits = 0;
  activeContext.poolMisses = 0;
}

// Export MAX_POOL_SIZE for node-pool compatibility
export { MAX_POOL_SIZE };

// Export the Signal constructor for prototype extensions
export { Signal };
