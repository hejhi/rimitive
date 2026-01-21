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

/**
 * Synchronous flush strategy (default).
 *
 * Executes effect re-runs immediately when dependencies change.
 * This is the default behavior when no strategy is specified.
 */
const sync = (run: () => void | (() => void)): FlushStrategy => ({
  run,
  create: (track) => (node) => {
    if (node.cleanup !== undefined) node.cleanup = node.cleanup();
    node.cleanup = track(node, run);
  },
});

// Predefined status combinations for effect nodes
const EFFECT_CLEAN = CONSUMER | SCHEDULED | CLEAN;

// Effect node type
export type EffectNode = ScheduledNode & {
  __type: 'effect';
  cleanup: void | (() => void);
};

/**
 * A flush strategy that controls when effect re-runs execute.
 *
 * Strategies allow deferring effect execution to microtasks, animation frames,
 * or custom timing. The initial run is always synchronous; strategies only
 * control subsequent re-runs when dependencies change.
 *
 * @example
 * ```ts
 * // Defer updates to microtask queue
 * effect(mt(() => expensiveWork(mySignal())));
 *
 * // Defer to animation frame (for visual updates)
 * effect(raf(() => updateCanvas(mySignal())));
 *
 * // Debounce rapid updates
 * effect(debounce(300, () => search(query())));
 * ```
 */
/**
 * A flush strategy controls when effect re-runs execute.
 */
export type FlushStrategy = {
  /** The effect function to run */
  run: () => void | (() => void);
  /** Create the flush function bound to track */
  create: (track: EffectDeps['track']) => (node: EffectNode) => void;
};

/** Input type for effect - either a plain function or a flush strategy */
type EffectRun = (() => void | (() => void)) | FlushStrategy;

/**
 * The effect factory function type.
 * Accepts either a plain function or a FlushStrategy for deferred execution.
 */
export type EffectFactory = (run: EffectRun) => () => void;

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

  return function effect(run: EffectRun): () => void {
    // Normalize to strategy - use sync as default
    const { create, run: effectRun } = 'create' in run ? run : sync(run);

    const node: EffectNode = {
      __type: 'effect' as const,
      status: EFFECT_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      nextScheduled: undefined,
      trackingVersion: 0,
      cleanup: undefined,
      flush: create(track),
    };

    // Initial run is always synchronous (no flash of stale content)
    node.cleanup = track(node, effectRun);

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
    return (run: EffectRun): (() => void) => {
      // Extract the actual function from strategy or use directly
      const actualRun = 'run' in run ? run.run : run;

      const location = getCallerLocationFull(); // No skipFrames - function may be inlined
      const name = location?.display ?? 'Effect';
      const instrState = getInstrState(instr);
      const { id } = instr.register(actualRun, 'effect', name);

      const sourceLocation: SourceLocation | undefined = location;

      // Register node metadata for graph visualization
      registerNodeMeta(instrState, id, 'effect', name, sourceLocation);

      const wrappedRun = (() => {
        instr.emit({
          type: 'effect:run',
          timestamp: Date.now(),
          data: { effectId: id, name, sourceLocation },
        });
        return actualRun();
      }) as (() => void | (() => void)) & { __instrEffectId?: string };

      // Tag wrappedRun so GraphEdgesModule can associate node with ID in track()
      wrappedRun.__instrEffectId = id;

      // Reconstruct the run argument with wrapped function
      const wrappedStrategy: EffectRun =
        'run' in run ? { run: wrappedRun, create: run.create } : wrappedRun;

      const dispose = impl(wrappedStrategy);

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
