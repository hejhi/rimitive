import { ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { NodeScheduler } from './helpers/node-scheduler';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';

const { STATUS_CLEAN } = CONSTANTS;

export type EffectOpts = {
  ctx: GlobalContext;
  nodeScheduler: NodeScheduler;
  graphEdges: GraphEdges;
};

interface EffectNode extends ScheduledNode {
  __type: 'effect';
  _cleanup: (() => void) | undefined; // Cleanup from previous run
}

export function createEffectFactory(
  opts: EffectOpts
): LatticeExtension<
  'effect',
  (fn: () => void | (() => void)) => () => void
> {
  const {
    ctx,
    nodeScheduler: { dispose: disposeNode },
    graphEdges: { track, detachAll },
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
