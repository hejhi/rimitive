import {
  defineModule,
  getCallerLocationFull,
  type InstrumentationContext,
  type SourceLocation,
} from '@rimitive/core';
import {
  getInstrState,
  registerNodeMeta,
  removeNodeMeta,
  scheduleSnapshot,
} from './instrumentation-state';
import type { ScheduledNode } from './types';
import { GraphEdgesModule } from './deps/graph-edges';
import { SchedulerModule } from './deps/scheduler';
import { CONSTANTS } from './constants';

const { CLEAN, CONSUMER, SCHEDULED } = CONSTANTS;

// Predefined status combinations for effect nodes
const EFFECT_CLEAN = CONSUMER | SCHEDULED | CLEAN;

// Effect node type
type EffectNode = ScheduledNode & {
  __type: 'effect';
  cleanup?: void | (() => void);
};

/**
 * The effect factory function type
 */
export type EffectFactory = (fn: () => void | (() => void)) => () => void;

/**
 * Dependencies required by the Effect module.
 * @internal
 */
export type EffectDeps = {
  track: (
    node: ScheduledNode,
    fn: () => void | (() => void)
  ) => void | (() => void);
  dispose: (node: ScheduledNode, cleanup: () => void) => void;
};

// Re-export types needed for type inference
export type { GraphEdges } from './deps/graph-edges';
export type { Scheduler } from './deps/scheduler';

/**
 * Create an effect factory function.
 *
 * Effects are side effects that run when their dependencies change.
 * They run immediately on creation and re-run whenever any dependency changes.
 *
 * @example Basic composition
 * ```ts
 * import { compose } from '@rimitive/core';
 * import { SignalModule, EffectModule } from '@rimitive/signals/extend';
 *
 * const svc = compose(SignalModule, EffectModule);
 * const { signal, effect } = svc;
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
export function createEffectFactory(deps: EffectDeps): EffectFactory {
  const { track, dispose: disposeNode } = deps;

  return function effect(run: () => void | (() => void)): () => void {
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
  };
}

export const EffectModule = defineModule({
  name: 'effect',
  dependencies: [GraphEdgesModule, SchedulerModule],
  create: ({
    graphEdges,
    scheduler,
  }: {
    graphEdges: { track: EffectDeps['track'] };
    scheduler: { dispose: EffectDeps['dispose'] };
  }): EffectFactory => {
    return createEffectFactory({
      track: graphEdges.track,
      dispose: scheduler.dispose,
    });
  },
  instrument(
    impl: EffectFactory,
    instr: InstrumentationContext
  ): EffectFactory {
    return (run: () => void | (() => void)): (() => void) => {
      const location = getCallerLocationFull(); // No skipFrames - function may be inlined
      const name = location?.display ?? 'Effect';
      const instrState = getInstrState(instr);
      const { id } = instr.register(run, 'effect', name);

      const sourceLocation: SourceLocation | undefined = location;

      // Register node metadata for graph visualization
      registerNodeMeta(instrState, id, 'effect', name, sourceLocation);

      const wrappedRun = (() => {
        instr.emit({
          type: 'effect:run',
          timestamp: Date.now(),
          data: { effectId: id, name, sourceLocation },
        });
        return run();
      }) as (() => void | (() => void)) & { __instrEffectId?: string };

      // Tag wrappedRun so GraphEdgesModule can associate node with ID in track()
      wrappedRun.__instrEffectId = id;

      const dispose = impl(wrappedRun);

      return () => {
        instr.emit({
          type: 'effect:dispose',
          timestamp: Date.now(),
          data: { effectId: id, name, sourceLocation },
        });
        // Remove node metadata (also cleans up edges) and schedule snapshot
        removeNodeMeta(instrState, id);
        scheduleSnapshot(instrState, instr);
        dispose();
      };
    };
  },
});
