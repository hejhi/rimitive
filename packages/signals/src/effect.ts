import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type { ScheduledNode } from './types';
import { GraphEdges } from './deps/graph-edges';
import { CONSTANTS } from './constants';
import { Scheduler } from './deps/scheduler';

const { CLEAN, CONSUMER, SCHEDULED } = CONSTANTS;

// Predefined status combinations for effect nodes
const EFFECT_CLEAN = CONSUMER | SCHEDULED | CLEAN;

/**
 * Dependencies required by the Effect factory.
 * Wired automatically by presets - only needed for custom compositions.
 * @internal
 */
export type EffectDeps = {
  track: GraphEdges['track'];
  dispose: Scheduler['dispose'];
};

/**
 * Options for customizing Effect behavior.
 *
 * @example Adding instrumentation
 * ```ts
 * const effectService = Effect({
 *   instrument(impl, instr, ctx) {
 *     return (fn) => {
 *       const dispose = impl(fn);
 *       instr.emit({ type: 'effect:create', timestamp: Date.now(), data: {} });
 *       return dispose;
 *     };
 *   },
 * });
 * ```
 */
export type EffectOptions = {
  /** Custom instrumentation wrapper for debugging/profiling */
  instrument?: (
    impl: (fn: () => void | (() => void)) => () => void,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => (fn: () => void | (() => void)) => () => void;
};

// Re-export types for proper type inference
export type { GraphEdges } from './deps/graph-edges';
export type { Scheduler } from './deps/scheduler';

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

/**
 * Create an Effect service factory.
 *
 * Effects are side effects that run when their dependencies change.
 * They run immediately on creation and re-run whenever any dependency changes.
 *
 * **Most users should use the preset instead:**
 * ```ts
 * import { createSignals } from '@lattice/signals/presets/core';
 * const { effect } = createSignals()();
 * ```
 *
 * @example Basic effect
 * ```ts
 * const { signal, effect } = createSignals()();
 *
 * const count = signal(0);
 *
 * const dispose = effect(() => {
 *   console.log(`Count is ${count()}`);
 * });
 * // logs: "Count is 0"
 *
 * count(1); // logs: "Count is 1"
 * count(2); // logs: "Count is 2"
 *
 * dispose(); // stops tracking
 * count(3);  // no log
 * ```
 *
 * @example With cleanup
 * ```ts
 * const dispose = effect(() => {
 *   const id = setInterval(() => console.log('tick'), 1000);
 *
 *   // Return cleanup function
 *   return () => clearInterval(id);
 * });
 *
 * // Cleanup runs before each re-execution and on dispose
 * dispose();
 * ```
 *
 * @example DOM updates
 * ```ts
 * const title = signal('Hello');
 *
 * effect(() => {
 *   document.title = title();
 * });
 *
 * title('World'); // Document title updates automatically
 * ```
 */
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
