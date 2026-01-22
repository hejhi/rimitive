/**
 * Flush strategies for effects - composable timing control.
 *
 * Strategies allow deferring effect execution to microtasks, animation frames,
 * or custom timing. The initial run is always synchronous; strategies only
 * control subsequent re-runs when dependencies change.
 *
 * On the server, async strategies are skipped (effects using them become
 * no-ops) since deferred execution won't complete before SSR renders.
 * Use regular synchronous effects for server-side logic.
 */

import type { FlushStrategy } from './effect';
import { CONSTANTS } from './constants';

const { DISPOSED, STATE_MASK } = CONSTANTS;

/** Detect server environment - no window or no requestAnimationFrame */
const isServer = (): boolean =>
  typeof window === 'undefined' ||
  typeof requestAnimationFrame === 'undefined';

/** No-op strategy for server - effect is skipped entirely */
const noopStrategy: FlushStrategy = {
  run: () => {},
  create: () => () => {},
};

/**
 * Microtask flush strategy.
 *
 * Defers effect re-runs to the microtask queue. Rapid updates are coalesced -
 * only the latest state is processed. Useful for expensive computations that
 * don't need to run on every intermediate value.
 *
 * @example
 * ```ts
 * effect(mt(() => {
 *   expensiveComputation(mySignal());
 * }));
 *
 * mySignal(1);
 * mySignal(2);
 * mySignal(3); // Only this value triggers the computation
 * ```
 */
export const mt = (run: () => void | (() => void)): FlushStrategy => {
  if (isServer()) return noopStrategy;

  let version = 0;
  return {
    run,
    create: (track) => (node) => {
      const thisVersion = ++version;
      queueMicrotask(() => {
        if (thisVersion !== version) return; // Cancelled by newer update
        if ((node.status & STATE_MASK) === DISPOSED) return; // Already disposed
        if (node.cleanup !== undefined) node.cleanup = node.cleanup();
        node.cleanup = track(node, run);
      });
    },
  };
};

/**
 * RequestAnimationFrame flush strategy.
 *
 * Defers effect re-runs to the next animation frame. Ideal for visual updates
 * that should sync with the browser's repaint cycle. Automatically cancels
 * pending frames when new updates arrive.
 *
 * @example
 * ```ts
 * effect(raf(() => {
 *   canvas.drawScene(position());
 * }));
 * ```
 */
export const raf = (run: () => void | (() => void)): FlushStrategy => {
  if (isServer()) return noopStrategy;

  let frameId: number | null = null;
  return {
    run,
    create: (track) => (node) => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        if ((node.status & STATE_MASK) === DISPOSED) return; // Already disposed
        if (node.cleanup !== undefined) node.cleanup = node.cleanup();
        node.cleanup = track(node, run);
      });
    },
  };
};

/**
 * Debounce flush strategy.
 *
 * Delays effect re-runs until no updates have occurred for the specified
 * duration. Useful for search inputs or other cases where you want to wait
 * for user input to settle.
 *
 * @param ms - Debounce delay in milliseconds
 *
 * @example
 * ```ts
 * effect(debounce(300, () => {
 *   searchAPI(query());
 * }));
 * ```
 */
export const debounce = (
  ms: number,
  run: () => void | (() => void)
): FlushStrategy => {
  if (isServer()) return noopStrategy;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return {
    run,
    create: (track) => (node) => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if ((node.status & STATE_MASK) === DISPOSED) return; // Already disposed
        if (node.cleanup !== undefined) node.cleanup = node.cleanup();
        node.cleanup = track(node, run);
      }, ms);
    },
  };
};
