import { createGraphEdges } from './graph-edges';
import { createGraphTraversal } from './graph-traversal';
import { createPullPropagator } from './pull-propagator';
import { createScheduler } from './scheduler';
import { createUntracked } from '../untrack';

// Push
// (signals only)
export function createPush() {
  const edges = createGraphEdges();
  const untrack = createUntracked({ consumer: edges.consumer });

  return {
    untrack,
    ...edges,
    ...createGraphTraversal(),
  };
}

// Push, pull
// (signals, computeds)
export function createPushPull() {
  const { track, ...restPush } = createPush();

  return {
    track,
    ...restPush,
    ...createPullPropagator({ track }),
  };
}

// Push, schedule
// (signals, effects)
export function createPushSchedule() {
  const { detachAll, track, withVisitor, ...restPush } = createPush();
  const { withPropagate, ...scheduler } = createScheduler({ detachAll });

  return {
    detachAll,
    track,
    ...restPush,
    ...scheduler,
    propagate: withPropagate(withVisitor),
  };
}

// Push, pull, schedule
// (signals, computeds, effects)
export function createPushPullSchedule() {
  const { detachAll, track, withVisitor, ...restPushPull } = createPushPull();
  const { withPropagate, ...scheduler } = createScheduler({ detachAll });
  const pull = createPullPropagator({ track });

  return {
    detachAll,
    track,
    ...restPushPull,
    ...scheduler,
    ...pull,
    propagate: withPropagate(withVisitor),
  };
}
