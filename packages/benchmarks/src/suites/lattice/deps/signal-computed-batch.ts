import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';
import { createPullPropagator } from '@lattice/signals/deps/pull-propagator';
import { createScheduler } from '@lattice/signals/deps/scheduler';

export const createSvc = () => {
  const graphEdges = createGraphEdges();
  const { pullUpdates, shallowPropagate } = createPullPropagator({
    track: graphEdges.track,
  });
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const propagate = scheduler.withPropagate(withVisitor);

  const signal = createSignalFactory({
    graphEdges,
    propagate,
  });

  const computed = createComputedFactory({
    consumer: graphEdges.consumer,
    trackDependency: graphEdges.trackDependency,
    pullUpdates,
    track: graphEdges.track,
    shallowPropagate,
  });

  function batch<T>(fn: () => T): T {
    scheduler.startBatch();
    try {
      return fn();
    } finally {
      scheduler.endBatch();
    }
  }

  return { signal, computed, batch };
};
