import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type { GlobalContext } from './context';
import type { ScheduledNode } from './types';
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
};

export type EffectProps = {
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

// Effect node interface
interface EffectNode extends ScheduledNode {
  __type: 'effect';
  cleanup?: void | (() => void);
}

export const Effect = create(
  ({ dispose: disposeNode, track }: EffectOpts) =>
    (props?: EffectProps): EffectFactory => {
      const { instrument } = props ?? {};

      function createEffect(run: () => void | (() => void)): () => void {
        const node: EffectNode = {
          __type: 'effect' as const,
          status: EFFECT_CLEAN,
          dependencies: undefined,
          dependencyTail: undefined,
          nextScheduled: undefined,
          trackingVersion: 0,
          cleanup: undefined,
          flush(): void {
            if (node.cleanup !== undefined) node.cleanup = node.cleanup();
            node.cleanup = track(node, run);
          },
        };

        // Run a single time on creation
        node.cleanup = track(node, run);

        // Return dispose function
        return () => {
          disposeNode(node, () => {
            if (node.cleanup === undefined) return;
            node.cleanup = node.cleanup();
          });
        };
      }

      const extension: EffectFactory = {
        name: 'effect',
        method: createEffect,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
