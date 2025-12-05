import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type { ScheduledNode } from './types';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';
import { Scheduler } from './helpers/scheduler';

const { CLEAN, CONSUMER, SCHEDULED } = CONSTANTS;

// Predefined status combinations for effect nodes
const EFFECT_CLEAN = CONSUMER | SCHEDULED | CLEAN;

/**
 * Internal dependencies required by the Effect factory.
 * These are wired automatically by presets - users don't need to provide them.
 * @internal
 */
type EffectDeps = {
  track: GraphEdges['track'];
  dispose: Scheduler['dispose'];
};

/**
 * Options for customizing Effect behavior.
 * Pass to Effect() when creating a custom service composition.
 */
export type EffectOptions = {
  instrument?: (
    impl: (fn: () => void | (() => void)) => () => void,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => (fn: () => void | (() => void)) => () => void;
};

// Re-export types for proper type inference
export type { GraphEdges } from './helpers/graph-edges';
export type { Scheduler } from './helpers/scheduler';

/**
 * ServiceDefinition for the effect primitive.
 * This is what gets composed into a service context.
 */
export type EffectFactory = ServiceDefinition<
  'effect',
  (fn: () => void | (() => void)) => () => void
>;

/**
 * The instantiable service returned by Effect().
 *
 * Use this type when building custom service compositions:
 * @example
 * ```ts
 * import { Effect, type EffectService } from '@lattice/signals/effect';
 *
 * const effectService: EffectService = Effect();
 * const factory = effectService.create(deps); // EffectFactory
 * ```
 */
export type EffectService = ReturnType<typeof Effect>;

// Effect node type
type EffectNode = ScheduledNode & {
  __type: 'effect';
  cleanup?: void | (() => void);
};

export const Effect = defineService(
  ({ dispose: disposeNode, track }: EffectDeps) =>
    ({ instrument }: EffectOptions = {}): EffectFactory => {
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
        impl: createEffect,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
