/**
 * ALGORITHM: Shared MutationObserver for DOM Lifecycle Tracking
 *
 * Uses a single MutationObserver to track connection/disconnection of all elements.
 * Captures state in closure for tree-shakeability and replaceability.
 *
 * Pattern:
 * - Factory function creates the observer with closure-captured state
 * - Returns interface with observe methods
 * - Observer starts watching document on first tracked element
 * - Automatic cleanup when no elements are tracked
 *
 * Bookkeeping (2 structures):
 * - WeakMap: tracks callbacks and cleanup per element
 * - Set: enables iteration during mutation events
 */

export type DOMElement = HTMLElement;

/**
 * Lifecycle tracking per element
 * Single structure to reduce bookkeeping
 */
interface ElementTracking {
  onConnected?: (element: DOMElement) => void | (() => void);
  onDisconnected?: (element: DOMElement) => void;
  cleanup?: () => void; // Cleanup function returned by onConnected
}

/**
 * Interface for lifecycle observer operations
 */
export interface LifecycleObserver {
  /** Observe when an element connects to the DOM */
  observeConnection: (
    element: DOMElement,
    onConnected?: (element: DOMElement) => void | (() => void)
  ) => () => void;
  /** Observe when an element disconnects from the DOM */
  observeDisconnection: (
    element: DOMElement,
    onDisconnected?: (element: DOMElement) => void
  ) => () => void;
}

/**
 * Create a lifecycle observer with shared MutationObserver
 * Closure-captured state like signals/graph-edges.ts
 */
export function createLifecycleObserver(): LifecycleObserver {
  // Closure-captured state - minimal bookkeeping
  const tracking = new WeakMap<DOMElement, ElementTracking>();
  const trackedElements = new Set<DOMElement>();

  /**
   * Shared MutationObserver - created immediately
   * Observer created eagerly, starts observing on first tracked element
   */
  const sharedObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Handle added nodes (connections)
      if (mutation.addedNodes.length > 0) {
        const addedNodes = Array.from(mutation.addedNodes);
        for (const node of addedNodes) {
          if (!(node instanceof Element)) continue;

          // Check each tracked element to see if it was affected
          for (const element of trackedElements) {
            const elementTracking = tracking.get(element);
            if (!elementTracking?.onConnected) continue;

            // Check if element was added or is a descendant of added node
            if (node === element || node.contains(element)) {
              if (element.isConnected) {
                const cleanup = elementTracking.onConnected(element);
                if (cleanup) {
                  elementTracking.cleanup = cleanup;
                }
                // Clear the onConnected callback after firing once
                elementTracking.onConnected = undefined;
              }
            }
          }
        }
      }

      // Handle removed nodes (disconnections)
      if (mutation.removedNodes.length > 0) {
        const removedNodes = Array.from(mutation.removedNodes);
        for (const node of removedNodes) {
          if (!(node instanceof Element)) continue;

          // Check each tracked element to see if it was affected
          for (const element of trackedElements) {
            const elementTracking = tracking.get(element);
            if (!elementTracking?.onDisconnected) continue;

            // Check if element was removed or is a descendant of removed node
            if (node === element || node.contains(element)) {
              if (!element.isConnected) {
                // Call any cleanup function stored during connection
                if (elementTracking.cleanup) {
                  elementTracking.cleanup();
                }

                // Call disconnection callback
                elementTracking.onDisconnected(element);

                // Clean up tracking
                tracking.delete(element);
                trackedElements.delete(element);
              }
            }
          }
        }
      }
    }

    // Auto-disconnect observer when no elements tracked (memory optimization)
    if (trackedElements.size === 0) {
      sharedObserver.disconnect();
    }
  });

  /**
   * Observe when an element is connected to the DOM
   */
  const observeConnection = (
    element: DOMElement,
    onConnected?: (element: DOMElement) => void | (() => void)
  ): (() => void) => {
    if (!onConnected) {
      return () => {}; // No-op cleanup
    }

    // If already connected, call immediately and store cleanup
    if (element.isConnected) {
      const cleanup = onConnected(element);
      if (cleanup) {
        const elementTracking = tracking.get(element) || {};
        elementTracking.cleanup = cleanup;
        tracking.set(element, elementTracking);
      }
      return () => {}; // No-op cleanup
    }

    // Add to shared tracking
    const elementTracking = tracking.get(element) || {};
    elementTracking.onConnected = onConnected;
    tracking.set(element, elementTracking);
    trackedElements.add(element);

    // Re-observe document if observer was disconnected
    if (trackedElements.size === 1) {
      sharedObserver.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    }

    // Return cleanup function
    return () => {
      const elementTracking = tracking.get(element);
      if (elementTracking && elementTracking.onConnected) {
        elementTracking.onConnected = undefined;

        // Remove from set if no callbacks remain
        if (!elementTracking.onDisconnected) {
          tracking.delete(element);
          trackedElements.delete(element);
        }
      }
    };
  };

  /**
   * Observe when an element is disconnected from the DOM
   */
  const observeDisconnection = (
    element: DOMElement,
    onDisconnected?: (element: DOMElement) => void
  ): (() => void) => {
    if (!onDisconnected) {
      return () => {}; // No-op cleanup
    }

    // Add to shared tracking
    const elementTracking = tracking.get(element) || {};
    elementTracking.onDisconnected = onDisconnected;
    tracking.set(element, elementTracking);
    trackedElements.add(element);

    // Re-observe document if observer was disconnected
    if (trackedElements.size === 1) {
      sharedObserver.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    }

    // Return cleanup function
    return () => {
      const elementTracking = tracking.get(element);
      if (elementTracking && elementTracking.onDisconnected) {
        elementTracking.onDisconnected = undefined;

        // Remove from set if no callbacks remain
        if (!elementTracking.onConnected) {
          tracking.delete(element);
          trackedElements.delete(element);
        }
      }
    };
  };

  return {
    observeConnection,
    observeDisconnection,
  };
}
