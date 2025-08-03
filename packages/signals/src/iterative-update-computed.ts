import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, StatefulNode, Disposable } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createDependencyHelpers, EdgeCache } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createGraphTraversalHelpers } from './helpers/graph-traversal';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';
import { createIterativeUpdateHelpers } from './helpers/iterative-update';

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

export function createIterativeUpdateComputedFactory(ctx: SignalContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  const depHelpers = createDependencyHelpers();
  const { addDependency } = depHelpers
  const { disposeAllSources } =
    createSourceCleanupHelpers(depHelpers);
  const scheduledConsumerHelpers = createScheduledConsumerHelpers(ctx);
  const { traverseAndInvalidate } = createGraphTraversalHelpers(ctx, scheduledConsumerHelpers);
  const { iterativeUpdate } = createIterativeUpdateHelpers();
  
  class IterativeUpdateComputed<T> implements ComputedInterface<T> {
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
      
      // Use iterative update instead of recursive
      iterativeUpdate(this as any, ctx);
      return this._value!;
    }

    peek(): T {
      iterativeUpdate(this as any, ctx);
      return this._value!;
    }

    _recompute(): void {
      // This method exists for compatibility but won't be called
      // iterativeUpdate handles the recomputation internally
      throw new Error('_recompute should not be called in iterative implementation');
    }

    _invalidate(): void {
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      this._flags |= NOTIFIED;
      if (this._targets) traverseAndInvalidate(this._targets);
    }

    _update(): void {
      // This method exists for compatibility but won't be called directly
      // iterativeUpdate handles everything
      iterativeUpdate(this as any, ctx);
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
    method: <T>(compute: () => T): ComputedInterface<T> => new IterativeUpdateComputed(compute)
  };
}