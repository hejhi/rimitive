/**
 * Core Signals Preset
 * Pre-configured bundle of signal primitives with all necessary helpers wired up.
 * This eliminates the boilerplate of manually creating and wiring helpers.
 */

import { Signal } from '../signal';
import { Computed } from '../computed';
import { Effect } from '../effect';
import { Batch } from '../batch';
import { Subscribe } from '../subscribe';
import { createBaseContext } from '../context';
import { createGraphEdges } from '../helpers/graph-edges';
import { createGraphTraversal } from '../helpers/graph-traversal';
import { createScheduler } from '../helpers/scheduler';
import { createPullPropagator } from '../helpers/pull-propagator';

export interface SignalsCoreResult {
  /** Array of pre-configured signal extensions */
  extensions: [
    ReturnType<ReturnType<typeof Signal>['create']>,
    ReturnType<ReturnType<typeof Computed>['create']>,
    ReturnType<ReturnType<typeof Effect>['create']>,
    ReturnType<ReturnType<typeof Batch>['create']>,
    ReturnType<ReturnType<typeof Subscribe>['create']>,
  ];
  /** Internal helpers exposed for advanced usage (e.g., view layer wiring) */
  helpers: {
    ctx: ReturnType<typeof createBaseContext>;
    track: ReturnType<typeof createGraphEdges>['track'];
    trackDependency: ReturnType<typeof createGraphEdges>['trackDependency'];
    detachAll: ReturnType<typeof createGraphEdges>['detachAll'];
    dispose: ReturnType<typeof createScheduler>['dispose'];
    startBatch: ReturnType<typeof createScheduler>['startBatch'];
    endBatch: ReturnType<typeof createScheduler>['endBatch'];
    pullUpdates: ReturnType<typeof createPullPropagator>['pullUpdates'];
    shallowPropagate: ReturnType<typeof createPullPropagator>['shallowPropagate'];
    propagate: (subscribers: any) => void;
  };
}

/**
 * Core signals preset - returns array of pre-configured extensions + helpers
 * This is the main API for creating a complete signals context.
 */
export function signalsCore(): SignalsCoreResult {
  // Wire up all the helpers
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const _scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const { withPropagate, ...scheduler} = _scheduler;
  const pullPropagator = createPullPropagator({ track: graphEdges.track });

  const helpers = {
    ctx,
    trackDependency: graphEdges.trackDependency,
    track: graphEdges.track,
    detachAll: graphEdges.detachAll,
    propagate: withPropagate(withVisitor),
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
    dispose: scheduler.dispose,
    startBatch: scheduler.startBatch,
    endBatch: scheduler.endBatch,
  };

  // Return extensions + helpers for advanced usage
  return {
    extensions: [
      Signal().create(helpers),
      Computed().create(helpers),
      Effect().create(helpers),
      Batch().create(helpers),
      Subscribe().create(helpers),
    ],
    helpers,
  };
}

