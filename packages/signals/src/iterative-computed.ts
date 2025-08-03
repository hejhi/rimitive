import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, StatefulNode, Disposable, ConsumerNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createDependencyHelpers, EdgeCache } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createGraphTraversalHelpers } from './helpers/graph-traversal';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';

export interface ComputedInterface<T = unknown> extends Readable<T>, ProducerNode, EdgeCache, StatefulNode, Disposable {
  __type: 'computed';
  readonly value: T;
  peek(): T;
  dispose(): void;
}

const {
  RUNNING,
  DISPOSED,
  OUTDATED,
  NOTIFIED,
  IS_COMPUTED,
} = CONSTANTS;

interface UpdateNode extends ConsumerNode, ProducerNode {
  _flags: number;
  _globalVersion?: number;
  _callback?: () => unknown;
  _version: number;
  _value?: unknown;
  _lastEdge?: Edge;
}

export function createIterativeComputedFactory(ctx: SignalContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  const depHelpers = createDependencyHelpers();
  const { addDependency } = depHelpers;
  const { disposeAllSources, cleanupSources } = createSourceCleanupHelpers(depHelpers);
  const scheduledConsumerHelpers = createScheduledConsumerHelpers(ctx);
  const { traverseAndInvalidate } = createGraphTraversalHelpers(ctx, scheduledConsumerHelpers);
  
  // Iterative update implementation
  const iterativeUpdate = (rootNode: UpdateNode): void => {
    const updateStack: UpdateNode[] = [];
    const visiting = new Set<UpdateNode>();
    const toProcess: UpdateNode[] = [rootNode];
    
    // First pass: collect all nodes that need updating
    while (toProcess.length > 0) {
      const node = toProcess.pop()!;
      
      if (visiting.has(node)) {
        throw new Error('Cycle detected');
      }
      
      // Skip if already up to date
      if (!(node._flags & (OUTDATED | NOTIFIED))) continue;
      if (node._globalVersion === ctx.version && !(node._flags & OUTDATED)) continue;
      
      visiting.add(node);
      updateStack.push(node);
      
      // Add sources to process
      let source = node._sources;
      while (source) {
        const sourceNode = source.source;
        if ('_flags' in sourceNode && '_callback' in sourceNode) {
          const computedSource = sourceNode as UpdateNode;
          if (computedSource._flags & (OUTDATED | NOTIFIED)) {
            toProcess.push(computedSource);
          }
        }
        source = source.nextSource;
      }
    }
    
    // Second pass: update nodes in reverse order (sources first)
    while (updateStack.length > 0) {
      const node = updateStack.pop()!;
      visiting.delete(node);
      
      // Check if update is still needed
      if (!(node._flags & (OUTDATED | NOTIFIED))) continue;
      
      // Determine if dirty
      let isDirty = false;
      if (node._flags & OUTDATED) {
        isDirty = true;
      } else if (node._flags & NOTIFIED) {
        // Check sources
        let source = node._sources;
        while (source) {
          if (source.version !== source.source._version) {
            isDirty = true;
            source.version = source.source._version;
          }
          source = source.nextSource;
        }
      }
      
      if (isDirty) {
        // Recompute
        node._flags = (node._flags | RUNNING) & ~(OUTDATED | NOTIFIED);
        
        // Mark sources for tracking
        let source = node._sources;
        while (source) {
          source.version = -1;
          source = source.nextSource;
        }
        
        const prevConsumer = ctx.currentConsumer;
        ctx.currentConsumer = node;
        
        try {
          const oldValue = node._value;
          const newValue = node._callback!();
          
          if (newValue !== oldValue || node._version === 0) {
            node._value = newValue;
            node._version++;
          }
          
          node._globalVersion = ctx.version;
        } finally {
          ctx.currentConsumer = prevConsumer;
          node._flags &= ~RUNNING;
          cleanupSources(node);
        }
      } else {
        // Just clear flags and update version
        node._flags &= ~NOTIFIED;
        node._globalVersion = ctx.version;
      }
    }
  };
  
  class IterativeComputed<T> implements ComputedInterface<T> {
    __type = 'computed' as const;
    _callback: () => T;
    _value: T | undefined = undefined;
    _sources: Edge | undefined = undefined;
    _flags = OUTDATED | IS_COMPUTED;
    _targets: Edge | undefined = undefined;
    _lastEdge: Edge | undefined = undefined;
    _version = 0;
    _globalVersion = -1;

    constructor(compute: () => T) {
      this._callback = compute;
    }

    get value(): T {
      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // Track dependency if in computation context
      const consumer = ctx.currentConsumer;
      if (consumer && '_flags' in consumer && typeof consumer._flags === 'number' && consumer._flags & RUNNING) {
        addDependency(this, consumer, this._version);
      }
      
      iterativeUpdate(this as UpdateNode);
      return this._value!;
    }

    peek(): T {
      iterativeUpdate(this as UpdateNode);
      return this._value!;
    }

    _invalidate(): void {
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      this._flags |= NOTIFIED;
      if (this._targets) traverseAndInvalidate(this._targets);
    }

    dispose(): void {
      if (this._flags & DISPOSED) return;
      
      this._flags |= DISPOSED;
      disposeAllSources(this);
      this._value = undefined;
    }
  }

  return {
    name: 'computed',
    method: <T>(compute: () => T): ComputedInterface<T> => new IterativeComputed(compute)
  };
}