import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';
import { Scheduler } from './helpers/scheduler';

const { CLEAN, CONSUMER, SCHEDULED } = CONSTANTS;

// Predefined status combinations for effect nodes
const EFFECT_CLEAN = CONSUMER | SCHEDULED | CLEAN;

export type EffectOpts = {
  ctx: GlobalContext;
  track: GraphEdges['track'];
  dispose: Scheduler['dispose'];
  instrument?: (
    method: (fn: () => void | (() => void)) => () => void,
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => (fn: () => void | (() => void)) => () => void;
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
    dispose: disposeNode,
    track,
  } = opts;

  function createEffect(run: () => void | (() => void)): () => void {
    let cleanup: void | (() => void);

    const node = {
      __type: 'effect' as const,
      status: EFFECT_CLEAN,
      dependencies:  undefined,
      dependencyTail:  undefined,
      nextScheduled: undefined,
      trackingVersion: 0, // Initialize version tracking
      flush(): void {
        if (cleanup !== undefined) cleanup = cleanup();
        cleanup = track(node, run);
      }
    };

    // Run a single time on creation
    cleanup = track(node, run);

    // Return dispose function
    return () => disposeNode(node, () => {
      if (cleanup === undefined) return;
      cleanup = cleanup();
    });
  }

  const extension: EffectFactory = {
    name: 'effect',
    method: createEffect,
    ...(opts.instrument && { instrument: opts.instrument }),
  };

  return extension;
}
