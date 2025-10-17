/**
 * Shared MutationObserver for DOM Lifecycle Tracking
 *
 * Uses descent/unwind pattern.
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

/** Stack node for tree branches */
interface StackNode {
  el: Element;
  prev: StackNode | undefined;
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
 */
export function createLifecycleObserver(): LifecycleObserver {
  const tracking = new WeakMap<DOMElement, Tracking>();
  let trackedCount = 0;

  /**
   * Process tree with descent/unwind pattern
   * Fires callbacks inline during traversal - no array buffering
   */
  const processTree = (root: Element, statusBit: number): void => {
    let el: Element | null = root;
    let stack: StackNode | undefined;

    for (;;) {
      // Process current element if tracked (HTMLElement only)
      if (el instanceof HTMLElement) {
        const t = tracking.get(el);
        if (t && !(t.status & statusBit)) {
          // Mark with status bit
          t.status |= statusBit;

          // Fire callback inline (single-pass mark + pull)
          if (statusBit === CONNECTED && el.isConnected) {
            if (t.onConnect) {
              t.cleanup = t.onConnect(el) ?? t.cleanup;
              t.onConnect = undefined; // Fire once per instance
            }
          } else if (statusBit === DISCONNECTED && !el.isConnected) {
            t.cleanup?.();
            t.onDisconnect?.(el);
            tracking.delete(el);
            trackedCount--;
          }

          // Clear status (ready for next batch)
          t.status = 0;
        }
      }

      // Descend to first child
      const firstChild: Element | null = el.firstElementChild;
      if (firstChild) {
        const nextSibling: Element | null = el.nextElementSibling;
        // Branch point - push sibling to stack
        if (nextSibling) stack = { el: nextSibling, prev: stack };
        el = firstChild;
        continue;
      }

      // No children - try next sibling
      const sibling: Element | null = el.nextElementSibling;
      if (sibling) {
        el = sibling;
        continue;
      }

      // Unwind stack
      if (stack) {
        el = stack.el;
        stack = stack.prev;
        continue;
      }

      // Done
      break;
    }
  };

  /**
   * Shared MutationObserver - processes trees inline, no buffering
   */
  const observer = new MutationObserver((mutations) => {
    // Process each mutation's trees immediately
    for (const mutation of mutations) {
      // Handle additions
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i];
        if (node instanceof Element) processTree(node, CONNECTED);
      }

      // Handle removals
      for (let i = 0; i < mutation.removedNodes.length; i++) {
        const node = mutation.removedNodes[i];
        if (node instanceof Element) processTree(node, DISCONNECTED);
      }
    }

    // Auto-disconnect when empty
    if (trackedCount === 0) observer.disconnect();
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

    // Fast path: already connected, fire immediately
    if (element.isConnected && onConnected) {
      const result = onConnected(element);
      const cleanup = typeof result === 'function' ? result : undefined;

      // Track for disconnect if needed
      if (cleanup || onDisconnected) {
        tracking.set(element, {
          status: 0,
          onDisconnect: onDisconnected,
          cleanup
        });
        trackedCount++; // Increment count

        // Start observer if first element
        if (trackedCount === 1) {
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
          });
        }

        return () => {
          if (tracking.delete(element)) trackedCount--;
        };
      }

      return () => {}; // No tracking needed
    }

    // Deferred path: track for future connection
    const existing = tracking.get(element);

    tracking.set(element, {
      status: existing?.status ?? 0,
      onConnect: onConnected ?? existing?.onConnect,
      onDisconnect: onDisconnected ?? existing?.onDisconnect,
      cleanup: existing?.cleanup,
    });

    if (!existing) trackedCount++; // Increment only for new tracking

    // Start observer if first element
    if (trackedCount === 1) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (tracking.delete(element)) trackedCount--;
    };
  };

  return { observe };
}
