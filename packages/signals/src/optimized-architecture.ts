// Optimized modular architecture for signals
// This demonstrates how to maintain performance while keeping modularity

// ===== Types Module =====
export const RUNNING = 1 << 2;
export const DISPOSED = 1 << 3;
export const OUTDATED = 1 << 1;
export const NOTIFIED = 1 << 0;
export const TRACKING = 1 << 4;
export const IS_COMPUTED = 1 << 5;

export interface SignalContext {
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

// ===== Context Factory =====
const MAX_POOL_SIZE = 1000;
const INITIAL_POOL_SIZE = 100;

function initializeNodePool(): DependencyNode[] {
  const pool = new Array(INITIAL_POOL_SIZE) as DependencyNode[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    pool[i] = {} as DependencyNode;
  }
  return pool;
}

export function createContext(): SignalContext {
  return {
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
}

// ===== Signal Module Factory =====
export function createSignalClass(ctx: SignalContext) {
  return class Signal<T> implements ISignal<T> {
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
      if (!ctx.currentComputed || !(ctx.currentComputed._flags & RUNNING)) {
        return this._value;
      }

      const current = ctx.currentComputed;

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
      ctx.allocations++;
      const newNode =
        ctx.poolSize > 0
          ? (ctx.poolHits++, ctx.nodePool[--ctx.poolSize]!)
          : (ctx.poolMisses++, {} as DependencyNode);

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
      ctx.version++;

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
  };
}

// ===== Node Operations Helpers =====
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

// ===== Computed Module Factory =====
export function createComputedClass(ctx: SignalContext) {
  return class Computed<T> implements IComputed<T> {
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
      this._addDependency(ctx.currentComputed);
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

      const prevComputed = ctx.currentComputed;
      try {
        this._prepareSourcesTracking();
        ctx.currentComputed = this;
        this._updateValue();
        this._globalVersion = ctx.version;
      } finally {
        ctx.currentComputed = prevComputed;
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

    _addDependency(target: IComputed | IEffect | null): void {
      if (!target || !(target._flags & RUNNING)) return;

      const version = this._version;

      if (this._tryReuseNode(target, version)) return;
      if (this._findExistingDependency(target, version)) return;

      this._createNewDependency(target, version);
    }

    _tryReuseNode(target: IComputed | IEffect, version: number): boolean {
      const node = this._node;
      if (node !== undefined && node.target === target) {
        node.version = version;
        return true;
      }
      return false;
    }

    _findExistingDependency(
      target: IComputed | IEffect,
      version: number
    ): boolean {
      let node = target._sources;
      while (node) {
        if (node.source === (this as IComputed<T>)) {
          node.version = version;
          return true;
        }
        node = node.nextSource;
      }
      return false;
    }

    _createNewDependency(
      target: IComputed | IEffect,
      version: number
    ): void {
      // INLINE acquireNode for performance
      ctx.allocations++;
      const newNode =
        ctx.poolSize > 0
          ? (ctx.poolHits++, ctx.nodePool[--ctx.poolSize]!)
          : (ctx.poolMisses++, {} as DependencyNode);

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

    _isUpToDate(): boolean {
      return (
        !(this._flags & OUTDATED) &&
        this._version > 0 &&
        this._globalVersion === ctx.version
      );
    }

    _checkSources(): boolean {
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

    _prepareSourcesTracking(): void {
      for (let node = this._sources; node !== undefined; node = node.nextSource) {
        node.version = -1;
      }
    }

    _updateValue(): boolean {
      const newValue = this._compute();
      const changed = newValue !== this._value || this._version === 0;
      if (changed) {
        this._value = newValue;
        this._version++;
      }
      return changed;
    }

    _cleanupSources(): void {
      let node = this._sources;
      let prev: DependencyNode | undefined;

      while (node !== undefined) {
        const next = node.nextSource;

        if (node.version === -1) {
          this._removeNode(node, prev);
          // INLINE releaseNode
          if (ctx.poolSize < MAX_POOL_SIZE) {
            node.source = undefined!;
            node.target = undefined!;
            node.version = 0;
            node.nextSource = undefined;
            node.prevSource = undefined;
            node.nextTarget = undefined;
            node.prevTarget = undefined;
            ctx.nodePool[ctx.poolSize++] = node;
          }
        } else {
          prev = node;
        }

        node = next;
      }
    }

    _removeNode(
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

    _disposeAllSources(): void {
      let node = this._sources;
      while (node) {
        const next = node.nextSource;
        removeFromTargets(node);
        
        // Inline releaseNode
        if (ctx.poolSize < MAX_POOL_SIZE) {
          node.source = undefined!;
          node.target = undefined!;
          node.version = 0;
          node.nextSource = undefined;
          node.prevSource = undefined;
          node.nextTarget = undefined;
          node.prevTarget = undefined;
          ctx.nodePool[ctx.poolSize++] = node;
        }
        
        node = next;
      }
      this._sources = undefined;
    }
  };
}

// ===== Effect Module Factory =====
export function createEffectClass(ctx: SignalContext) {
  return class Effect implements IEffect {
    __type = 'effect' as const;
    _fn: () => void;
    _flags = OUTDATED;
    _sources: DependencyNode | undefined = undefined;
    _nextBatchedEffect: IEffect | undefined = undefined;

    constructor(fn: () => void) {
      this._fn = fn;
    }

    _notify(): void {
      if (this._flags & NOTIFIED) return;
      this._flags |= NOTIFIED | OUTDATED;

      if (ctx.batchDepth > 0) {
        this._nextBatchedEffect = ctx.batchedEffects || undefined;
        ctx.batchedEffects = this;
        return;
      }

      ctx.batchDepth++;
      try {
        this._run();
      } finally {
        if (--ctx.batchDepth === 0) {
          let effect = ctx.batchedEffects;
          if (effect) {
            ctx.batchedEffects = null;
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

      const prevComputed = ctx.currentComputed;
      ctx.currentComputed = this;

      try {
        this._fn();
      } finally {
        ctx.currentComputed = prevComputed;
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
            
            // Inline releaseNode
            if (ctx.poolSize < MAX_POOL_SIZE) {
              node.source = undefined!;
              node.target = undefined!;
              node.version = 0;
              node.nextSource = undefined;
              node.prevSource = undefined;
              node.nextTarget = undefined;
              node.prevTarget = undefined;
              ctx.nodePool[ctx.poolSize++] = node;
            }
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
          
          // Inline releaseNode
          if (ctx.poolSize < MAX_POOL_SIZE) {
            node.source = undefined!;
            node.target = undefined!;
            node.version = 0;
            node.nextSource = undefined;
            node.prevSource = undefined;
            node.nextTarget = undefined;
            node.prevTarget = undefined;
            ctx.nodePool[ctx.poolSize++] = node;
          }
          
          node = next;
        }
        this._sources = undefined;
      }
    }
  };
}

// ===== Complete API Factory =====
export function createSignalAPI() {
  const ctx = createContext();
  const Signal = createSignalClass(ctx);
  const Computed = createComputedClass(ctx);
  const Effect = createEffectClass(ctx);
  
  return {
    signal<T>(value: T): ISignal<T> {
      return new Signal(value);
    },
    
    computed<T>(compute: () => T): IComputed<T> {
      return new Computed(compute);
    },
    
    effect(effectFn: () => void | (() => void)): EffectDisposer {
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
    },
    
    batch<T>(fn: () => T): T {
      if (ctx.batchDepth) return fn();

      ctx.batchDepth++;
      try {
        return fn();
      } finally {
        if (--ctx.batchDepth === 0) {
          let effect = ctx.batchedEffects;
          ctx.batchedEffects = null;
          while (effect) {
            const next: IEffect | null = effect._nextBatchedEffect || null;
            effect._nextBatchedEffect = undefined;
            effect._run();
            effect = next;
          }
        }
      }
    },
    
    untrack<T>(fn: () => T): T {
      const prev = ctx.currentComputed;
      ctx.currentComputed = null;
      try {
        return fn();
      } finally {
        ctx.currentComputed = prev;
      }
    },
    
    _ctx: ctx, // For testing/debugging
  };
}

