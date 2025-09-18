import { ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';
import { Scheduler } from './helpers/scheduler';

const { STATUS_CLEAN } = CONSTANTS;

export type EffectOpts = {
  ctx: GlobalContext;
  track: GraphEdges['track'];
  detachAll: GraphEdges['detachAll']
  dispose: Scheduler['dispose'];
};

// Re-export types for proper type inference
export type { GlobalContext } from './context';
export type { GraphEdges } from './helpers/graph-edges';
export type { Scheduler } from './helpers/scheduler';

// Export the factory return type for better type inference
export type EffectFactory = LatticeExtension<
  'effect',
  (fn: () => void | (() => void)) => () => void
>;

export function createEffectFactory(
  opts: EffectOpts
): EffectFactory {
  const {
    ctx,
    dispose: disposeNode,
    track,
    detachAll,
  } = opts;

  class EffectNode implements ScheduledNode {
    readonly __type = 'effect' as const;
    status = STATUS_CLEAN;
    dependencies = undefined;
    dependencyTail = undefined;
    deferredParent = undefined;
    nextScheduled = undefined;
    _cleanup: (() => void) | undefined = undefined;
    _run: () => void | (() => void);

    constructor(fn: () => void | (() => void)) {
      this._run = fn;
    }

    flush(): void {
      if (this._cleanup) {
        this._cleanup();
        this._cleanup = undefined;
      }
      const newCleanup = track(ctx, this, this._run);
      if (newCleanup) this._cleanup = newCleanup;
    }
  }

  function createEffect(run: () => void | (() => void)): () => void {
    const node = new EffectNode(run);

    // Initial run - inline to avoid extra call
    const newCleanup = track(ctx, node, run);
    if (newCleanup) node._cleanup = newCleanup;

    // Return dispose function
    return () => disposeNode(node, (node: EffectNode) => {
      if (node._cleanup) node._cleanup();
      detachAll(node);
    });
  }

  return {
    name: 'effect',
    method: createEffect,
  };
}
