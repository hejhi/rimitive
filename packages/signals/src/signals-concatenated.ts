// Single-file optimized signal implementation to test performance theory
// This file combines signal.ts, context.ts, and node-operations.ts into one module

// ===== Types (from types.ts) =====
export const RUNNING = 1 << 2;
export const DISPOSED = 1 << 3;
export const OUTDATED = 1 << 1;
export const NOTIFIED = 1 << 0;
export const TRACKING = 1 << 4;
export const IS_COMPUTED = 1 << 5;

export interface DependencyNode {
  source: ISignal | IComputed;
  target: IComputed | IEffect;
  version: number;
  nextSource: DependencyNode | undefined;
  prevSource: DependencyNode | undefined;
  nextTarget: DependencyNode | undefined;
  prevTarget: DependencyNode | undefined;
}

export interface ISignal<T = unknown> {
  readonly __type: 'signal';
  value: T;
  _value: T;
  _version: number;
  _targets: DependencyNode | undefined;
  _node: DependencyNode | undefined;
  _refresh(): boolean;
  set(key: unknown, value: unknown): void;
  patch(key: unknown, partial: unknown): void;
  peek(): T;
}

export interface IComputed<T = unknown> {
  readonly __type: 'computed';
  readonly value: T;
  _value: T | undefined;
  _version: number;
  _globalVersion: number;
  _flags: number;
  _sources: DependencyNode | undefined;
  _targets: DependencyNode | undefined;
  _node: DependencyNode | undefined;
  _compute: () => T;
  _refresh(): boolean;
  _notify(): void;
  dispose(): void;
  peek(): T;
}

export interface IEffect {
  readonly __type: 'effect';
  _flags: number;
  _sources: DependencyNode | undefined;
  _nextBatchedEffect: IEffect | undefined;
  _fn: () => void;
  _notify(): void;
  _run(): void;
  dispose(): void;
}

export interface EffectDisposer {
  (): void;
  __effect?: IEffect;
}

// ===== Context (inlined from context.ts) =====
interface SignalContext {
  currentComputed: IComputed | IEffect | null;
  version: number;
  batchDepth: number;
  batchedEffects: IEffect | null;
  nodePool: DependencyNode[];
  poolSize: number;
  allocations: number;
  poolHits: number;
  poolMisses: number;
}

const MAX_POOL_SIZE = 1000;
const INITIAL_POOL_SIZE = 100;

// Initialize node pool
function initializeNodePool(): DependencyNode[] {
  const pool = new Array(INITIAL_POOL_SIZE) as DependencyNode[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    pool[i] = {} as DependencyNode;
  }
  return pool;
}

// Active context - direct variable for maximum performance
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

// ===== Node Operations (inlined from node-operations.ts) =====
// Note: acquireNode is inlined directly in the code for maximum performance

function releaseNode(node: DependencyNode): void {
  if (activeContext.poolSize >= MAX_POOL_SIZE) return;

  node.source = undefined!;
  node.target = undefined!;
  node.version = 0;
  node.nextSource = undefined;
  node.prevSource = undefined;
  node.nextTarget = undefined;
  node.prevTarget = undefined;

  activeContext.nodePool[activeContext.poolSize++] = node;
}

function removeFromTargets(node: DependencyNode): void {
  const source = node.source;
  const prevTarget = node.prevTarget;
  const nextTarget = node.nextTarget;

  if (prevTarget !== undefined) {
    prevTarget.nextTarget = nextTarget;
  } else {
    source._targets = nextTarget;
    if (nextTarget === undefined && '_flags' in source) {
      (source as IComputed)._flags &= ~TRACKING;
    }
  }

  if (nextTarget !== undefined) {
    nextTarget.prevTarget = prevTarget;
  }
}

// ===== Signal Implementation =====
class Signal<T> implements ISignal<T> {
  __type = 'signal' as const;
  _value: T;
  _version = 0;
  _targets: DependencyNode | undefined = undefined;
  _node: DependencyNode | undefined = undefined;

  constructor(value: T) {
    this._value = value;
  }

  get value(): T {
    // Fast path: no tracking needed
    if (
      !activeContext.currentComputed ||
      !(activeContext.currentComputed._flags & RUNNING)
    ) {
      return this._value;
    }

    const current = activeContext.currentComputed;

    // Node reuse pattern - check if we can reuse existing node
    let node = this._node;
    if (node !== undefined && node.target === current) {
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

    // Create new dependency node - INLINE acquireNode for performance
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

  _refresh(): boolean {
    return true;
  }

  set(key: unknown, value: unknown): void {
    if (Array.isArray(this._value)) {
      const arr = [...this._value];
      const index = key as number;
      arr[index] = value;
      this.value = arr as T;
    } else if (typeof this._value === 'object' && this._value !== null) {
      const objKey = key as keyof T;
      this.value = { ...this._value, [objKey]: value } as T;
    }
  }

  patch(key: unknown, partial: unknown): void {
    if (Array.isArray(this._value)) {
      const arr = [...this._value];
      const index = key as number;
      const current = arr[index];
      arr[index] =
        typeof current === 'object' && current !== null
          ? { ...current, ...(partial as object) }
          : partial;
      this.value = arr as T;
    } else if (typeof this._value === 'object' && this._value !== null) {
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

  peek(): T {
    return this._value;
  }
}

// ===== Computed Implementation =====
class Computed<T> implements IComputed<T> {
  __type = 'computed' as const;
  _compute: () => T;
  _value: T | undefined = undefined;
  _version = 0;
  _globalVersion = -1;
  _flags = OUTDATED | IS_COMPUTED;
  _sources: DependencyNode | undefined = undefined;
  _targets: DependencyNode | undefined = undefined;
  _node: DependencyNode | undefined = undefined;

  constructor(compute: () => T) {
    this._compute = compute;
  }

  get value(): T {
    this._addDependency(activeContext.currentComputed);
    this._refresh();
    return this._value!;
  }

  _refresh(): boolean {
    this._flags &= ~NOTIFIED;

    if (this._flags & RUNNING) {
      throw new Error('Cycle detected');
    }

    if (this._isUpToDate()) {
      return true;
    }

    this._flags &= ~OUTDATED;
    this._flags |= RUNNING;

    if (this._version > 0 && !this._checkSources()) {
      this._flags &= ~RUNNING;
      return true;
    }

    const prevComputed = activeContext.currentComputed;
    try {
      this._prepareSourcesTracking();
      activeContext.currentComputed = this;
      this._updateValue();
      this._globalVersion = activeContext.version;
    } finally {
      activeContext.currentComputed = prevComputed;
      this._cleanupSources();
      this._flags &= ~RUNNING;
    }

    return true;
  }

  _notify(): void {
    if (!(this._flags & NOTIFIED)) {
      this._flags |= NOTIFIED | OUTDATED;

      let node = this._targets;
      while (node) {
        node.target._notify();
        node = node.nextTarget;
      }
    }
  }

  dispose(): void {
    if (!(this._flags & DISPOSED)) {
      this._flags |= DISPOSED;
      this._disposeAllSources();
      this._value = undefined;
    }
  }

  peek(): T {
    this._refresh();
    return this._value!;
  }

  private _addDependency(target: IComputed | IEffect | null): void {
    if (!target || !(target._flags & RUNNING)) return;

    const version = this._version;

    if (this._tryReuseNode(target, version)) return;
    if (this._findExistingDependency(target, version)) return;

    this._createNewDependency(target, version);
  }

  private _tryReuseNode(target: IComputed | IEffect, version: number): boolean {
    const node = this._node;
    if (node !== undefined && node.target === target) {
      node.version = version;
      return true;
    }
    return false;
  }

  private _findExistingDependency(
    target: IComputed | IEffect,
    version: number
  ): boolean {
    let node = target._sources;
    while (node) {
      if (node.source === this) {
        node.version = version;
        return true;
      }
      node = node.nextSource;
    }
    return false;
  }

  private _createNewDependency(
    target: IComputed | IEffect,
    version: number
  ): void {
    // INLINE acquireNode for performance
    activeContext.allocations++;
    const newNode =
      activeContext.poolSize > 0
        ? (activeContext.poolHits++,
          activeContext.nodePool[--activeContext.poolSize]!)
        : (activeContext.poolMisses++, {} as DependencyNode);

    newNode.source = this;
    newNode.target = target;
    newNode.version = version;
    newNode.nextSource = target._sources;
    newNode.nextTarget = this._targets;
    newNode.prevSource = undefined;
    newNode.prevTarget = undefined;

    if (target._sources) {
      target._sources.prevSource = newNode;
    }
    target._sources = newNode;

    if (this._targets) {
      this._targets.prevTarget = newNode;
    } else {
      this._flags |= TRACKING;
    }
    this._targets = newNode;

    this._node = newNode;
  }

  private _isUpToDate(): boolean {
    return (
      !(this._flags & OUTDATED) &&
      this._version > 0 &&
      this._globalVersion === activeContext.version
    );
  }

  private _checkSources(): boolean {
    for (let node = this._sources; node !== undefined; node = node.nextSource) {
      const source = node.source;
      if (
        node.version !== source._version ||
        !source._refresh() ||
        node.version !== source._version
      ) {
        return true;
      }
    }
    return false;
  }

  private _prepareSourcesTracking(): void {
    for (let node = this._sources; node !== undefined; node = node.nextSource) {
      node.version = -1;
    }
  }

  private _updateValue(): boolean {
    const newValue = this._compute();
    const changed = newValue !== this._value || this._version === 0;
    if (changed) {
      this._value = newValue;
      this._version++;
    }
    return changed;
  }

  private _cleanupSources(): void {
    let node = this._sources;
    let prev: DependencyNode | undefined;

    while (node !== undefined) {
      const next = node.nextSource;

      if (node.version === -1) {
        this._removeNode(node, prev);
        // INLINE releaseNode
        if (activeContext.poolSize < MAX_POOL_SIZE) {
          node.source = undefined!;
          node.target = undefined!;
          node.version = 0;
          node.nextSource = undefined;
          node.prevSource = undefined;
          node.nextTarget = undefined;
          node.prevTarget = undefined;
          activeContext.nodePool[activeContext.poolSize++] = node;
        }
      } else {
        prev = node;
      }

      node = next;
    }
  }

  private _removeNode(
    node: DependencyNode,
    prev: DependencyNode | undefined
  ): void {
    const next = node.nextSource;

    if (prev !== undefined) {
      prev.nextSource = next;
    } else {
      this._sources = next;
    }

    if (next !== undefined) {
      next.prevSource = prev;
    }

    removeFromTargets(node);
  }

  private _disposeAllSources(): void {
    let node = this._sources;
    while (node) {
      const next = node.nextSource;
      removeFromTargets(node);
      releaseNode(node);
      node = next;
    }
    this._sources = undefined;
  }
}

// ===== Effect Implementation =====
class Effect implements IEffect {
  __type = 'effect' as const;
  _fn: () => void;
  _flags = OUTDATED;
  _sources: DependencyNode | undefined = undefined;
  _nextBatchedEffect: Effect | undefined = undefined;

  constructor(fn: () => void) {
    this._fn = fn;
  }

  _notify(): void {
    if (this._flags & NOTIFIED) return;
    this._flags |= NOTIFIED | OUTDATED;

    if (activeContext.batchDepth > 0) {
      this._nextBatchedEffect = activeContext.batchedEffects || undefined;
      activeContext.batchedEffects = this;
      return;
    }

    activeContext.batchDepth++;
    try {
      this._run();
    } finally {
      if (--activeContext.batchDepth === 0) {
        let effect = activeContext.batchedEffects;
        if (effect) {
          activeContext.batchedEffects = null;
          while (effect) {
            const next: IEffect | undefined = effect._nextBatchedEffect;
            effect._nextBatchedEffect = undefined;
            effect._run();
            effect = next!;
          }
        }
      }
    }
  }

  _run(): void {
    if (this._flags & (DISPOSED | RUNNING)) return;

    this._flags = (this._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

    // Mark sources for cleanup
    let node = this._sources;
    while (node) {
      node.version = -1;
      node = node.nextSource;
    }

    const prevComputed = activeContext.currentComputed;
    activeContext.currentComputed = this;

    try {
      this._fn();
    } finally {
      activeContext.currentComputed = prevComputed;
      this._flags &= ~RUNNING;

      // Cleanup unused sources
      node = this._sources;
      let prev: DependencyNode | undefined;

      while (node) {
        const next = node.nextSource;

        if (node.version === -1) {
          if (prev) {
            prev.nextSource = next;
          } else {
            this._sources = next;
          }
          if (next) {
            next.prevSource = prev;
          }

          removeFromTargets(node);
          releaseNode(node);
        } else {
          prev = node;
        }

        node = next;
      }
    }
  }

  dispose(): void {
    if (!(this._flags & DISPOSED)) {
      this._flags |= DISPOSED;

      let node = this._sources;
      while (node) {
        const next = node.nextSource;
        removeFromTargets(node);
        releaseNode(node);
        node = next;
      }
      this._sources = undefined;
    }
  }
}

// ===== Factory Functions =====
export function signal<T>(value: T): ISignal<T> {
  return new Signal(value);
}

export function computed<T>(compute: () => T): IComputed<T> {
  return new Computed(compute);
}

export function effect(effectFn: () => void | (() => void)): EffectDisposer {
  let cleanupFn: (() => void) | void;

  const e = new Effect(() => {
    if (cleanupFn && typeof cleanupFn === 'function') {
      cleanupFn();
    }
    cleanupFn = effectFn();
  });

  e._run();

  const dispose = (() => {
    e.dispose();
    if (cleanupFn && typeof cleanupFn === 'function') {
      cleanupFn();
    }
  }) as EffectDisposer;

  dispose.__effect = e;

  return dispose;
}

export function batch<T>(fn: () => T): T {
  if (activeContext.batchDepth) return fn();

  activeContext.batchDepth++;
  try {
    return fn();
  } finally {
    if (--activeContext.batchDepth === 0) {
      let effect = activeContext.batchedEffects;
      activeContext.batchedEffects = null;
      while (effect) {
        const next: IEffect | null = effect._nextBatchedEffect || null;
        effect._nextBatchedEffect = undefined;
        effect._run();
        effect = next;
      }
    }
  }
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

// Export for testing
export { activeContext };
