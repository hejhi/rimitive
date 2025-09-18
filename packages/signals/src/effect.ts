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

interface EffectNode extends ScheduledNode {
  __type: 'effect';
  _cleanup: (() => void) | undefined; // Cleanup from previous run
}

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

  function createEffect(fn: () => void | (() => void)): () => void {
    const node: EffectNode = {
      __type: 'effect' as const,
      _cleanup: undefined,
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      nextScheduled: undefined,
      flush: () => {
        if (node._cleanup) {
          node._cleanup();
          node._cleanup = undefined;
        }
        const newCleanup = track(ctx, node, fn);
        if (newCleanup) node._cleanup = newCleanup;
      },
    };

    // Initial run - inline to avoid extra call
    const newCleanup = track(ctx, node, fn);
    if (newCleanup) node._cleanup = newCleanup;

    // Return dispose function
    return () => disposeNode(node, (node) => {
      if (node._cleanup) node._cleanup();
      detachAll(node);
    });
  }

  return {
    name: 'effect',
    method: createEffect,
  };
}
