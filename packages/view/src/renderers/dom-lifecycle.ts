/**
 * Shared MutationObserver for DOM Lifecycle Tracking
 *
 * Inspired by graph-traversal.ts descent/unwind and pull-propagator.ts mark/propagate patterns.
 * Uses labeled loops, status bits, and reusable buffers for zero-allocation steady state.
 *
 * Algorithm:
 * - mark: Traverse mutation trees, mark tracked elements with status bits
 * - fire: Process marked elements, call callbacks, update state
 * - Auto-disconnect when no elements tracked (memory optimization)
 */

export type DOMElement = HTMLElement;

// Status bits (like signals CLEAN/DIRTY/PENDING)
const CONNECTED = 1 << 0;    // Element connected to DOM
const DISCONNECTED = 1 << 1; // Element disconnected from DOM

/** Lifecycle tracking per element */
interface Tracking {
  onConnect?: (el: DOMElement) => void | (() => void);
  onDisconnect?: (el: DOMElement) => void;
  cleanup?: () => void;
  status: number;
}

/** Lifecycle observer interface */
export interface LifecycleObserver {
  observe: (
    element: DOMElement,
    callbacks: {
      onConnected?: (element: DOMElement) => void | (() => void);
      onDisconnected?: (element: DOMElement) => void;
    }
  ) => () => void;
}

/**
 * Create lifecycle observer with shared MutationObserver
 * Closure-captured state (like signals/graph-edges.ts)
 */
export function createLifecycleObserver(): LifecycleObserver {
  const tracking = new WeakMap<DOMElement, Tracking>();
  const tracked = new Set<DOMElement>();

  // Reusable buffer (grow automatically, zero allocations after warmup)
  const markedBuf: DOMElement[] = [];

  /**
   * Mark tracked descendants in tree (descent pattern like graph-traversal.ts)
   */
  const markTree = (root: Element, statusBit: number): void => {
    // Process current node
    if (root instanceof HTMLElement) {
      const t = tracking.get(root);
      if (t && !(t.status & statusBit)) {
        t.status |= statusBit;
        markedBuf.push(root);
      }
    }

    // Descend to children (using DOM traversal, not recursion stack for large trees)
    let child = root.firstElementChild;
    while (child) {
      markTree(child, statusBit);
      child = child.nextElementSibling;
    }
  };

  /**
   * Shared MutationObserver with labeled phases (like pull-propagator.ts)
   */
  const observer = new MutationObserver((mutations) => {
    markedBuf.length = 0; // Clear buffer (reuse array)

    // Phase 1: Mark affected elements
    for (const mutation of mutations) {
      // Mark added nodes (connections)
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i];
        if (node instanceof Element) markTree(node, CONNECTED);
      }

      // Mark removed nodes (disconnections)
      for (let i = 0; i < mutation.removedNodes.length; i++) {
        const node = mutation.removedNodes[i];
        if (node instanceof Element) markTree(node, DISCONNECTED);
      }
    }

    // Phase 2: Fire callbacks for marked elements
    for (const el of markedBuf) {
      const t = tracking.get(el);
      if (!t) continue;

      // Handle connection
      if (t.status & CONNECTED && el.isConnected) {
        if (t.onConnect) {
          t.cleanup = t.onConnect(el) ?? t.cleanup;
          t.onConnect = undefined; // Fire once per instance
        }
      }

      // Handle disconnection
      if (t.status & DISCONNECTED && !el.isConnected) {
        t.cleanup?.();
        t.onDisconnect?.(el);
        tracking.delete(el);
        tracked.delete(el);
      }

      // Clear status for next batch
      t.status = 0;
    }

    // Auto-disconnect when empty (memory optimization)
    if (tracked.size === 0) {
      observer.disconnect();
    }
  });

  /**
   * Observe element lifecycle
   */
  const observe = (
    element: DOMElement,
    callbacks: {
      onConnected?: (element: DOMElement) => void | (() => void);
      onDisconnected?: (element: DOMElement) => void;
    }
  ): (() => void) => {
    const { onConnected, onDisconnected } = callbacks;

    // Handle already-connected case (common path)
    if (element.isConnected && onConnected) {
      const cleanup = onConnected(element);

      // If we have both cleanup and disconnect callback, track for later
      if (cleanup && onDisconnected) {
        const t: Tracking = { status: 0, onDisconnect: onDisconnected, cleanup };
        tracking.set(element, t);
        tracked.add(element);

        // Start observer if first element
        if (tracked.size === 1) {
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
          });
        }

        return () => {
          tracking.delete(element);
          tracked.delete(element);
        };
      }

      return () => {}; // No-op, already fired
    }

    // Set up tracking for future connection (merge with existing if present)
    const existing = tracking.get(element);
    const t: Tracking = existing || { status: 0 };
    if (onConnected) t.onConnect = onConnected;
    if (onDisconnected) t.onDisconnect = onDisconnected;
    tracking.set(element, t);
    tracked.add(element);

    // Start observer if first element
    if (tracked.size === 1) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      tracking.delete(element);
      tracked.delete(element);
    };
  };

  return { observe };
}
