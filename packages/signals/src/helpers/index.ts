import { createBaseContext } from '../context';
import { createGraphEdges } from './graph-edges';
import { createGraphTraversal } from './graph-traversal';
import { createPullPropagator } from './pull-propagator';
import { createScheduler } from './scheduler';

// Push
export function createPush(ctx = createBaseContext()) {
  return {
    ctx,
    ...createGraphEdges({ ctx }),
    ...createGraphTraversal(),
  };
}

// Push, pull
export function createPushPull(ctx = createBaseContext()) {
  const { track, ...restPush } = createPush(ctx);

  return {
    track,
    ...restPush,
    ...createPullPropagator({ track })
  };
}

// Push, schedule
export function createPushSchedule(ctx = createBaseContext()) {
  const { detachAll, track, withVisitor, ...restPush } = createPush(ctx);
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
export function createPushPullSchedule(ctx = createBaseContext()) {
  const { detachAll, track, withVisitor, ...restPushPull } = createPushPull(ctx);
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
