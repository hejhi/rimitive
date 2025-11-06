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
import { createApi } from '@lattice/lattice';

/**
 * Core signals preset - returns array of pre-configured extensions + helpers
 * This is the main API for creating a complete signals context.
 */
export function signalsCore() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const _scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const { withPropagate, ...scheduler} = _scheduler;
  const pullPropagator = createPullPropagator({ track: graphEdges.track });

  return createApi(
    {
      signal: Signal(),
      computed: Computed(),
      effect: Effect(),
      batch: Batch(),
      subscribe: Subscribe()
    },
    {
      ctx,
      ...graphEdges,
      propagate: withPropagate(withVisitor),
      ...pullPropagator,
      ...scheduler
    }
  );
}

