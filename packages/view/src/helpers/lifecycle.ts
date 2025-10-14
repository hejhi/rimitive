/**
 * ALGORITHM: Shared MutationObserver for DOM Lifecycle Tracking
 *
 * Uses a single MutationObserver to track connection/disconnection of all elements.
 * Captures state in closure for tree-shakeability and replaceability.
 *
 * Pattern:
 * - Factory function creates the observer with closure-captured state
 * - Returns interface with observe methods
 * - Lazy initialization of observer
 * - Automatic cleanup when no elements are tracked
 */

export type DOMElement = HTMLElement;

/**
 * Lifecycle tracking callbacks
 */
interface LifecycleTracking {
  onConnected?: (element: DOMElement) => void | (() => void);
  onDisconnected?: (element: DOMElement) => void;
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
 * PATTERN: Closure-captured state like signals/graph-edges.ts
 */
export function createLifecycleObserver(): LifecycleObserver {
  // Closure-captured state
  const lifecycleTracking = new WeakMap<DOMElement, LifecycleTracking>();
  const trackedElements = new Set<DOMElement>();
  const disconnectionCleanupMap = new WeakMap<DOMElement, () => void>();
  let sharedObserver: MutationObserver | null = null;

  /**
   * Initialize the shared MutationObserver (lazy)
   */
  const ensureSharedObserver = (): void => {
    if (sharedObserver) return;

    sharedObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Handle added nodes (connections)
        if (mutation.addedNodes.length > 0) {
          const addedNodes = Array.from(mutation.addedNodes);
          for (const node of addedNodes) {
            if (!(node instanceof Element)) continue;

            // Check each tracked element to see if it was affected
            for (const element of trackedElements) {
              const tracking = lifecycleTracking.get(element);
              if (!tracking?.onConnected) continue;

              // Check if element was added or is a descendant of added node
              if (node === element || node.contains(element)) {
                if (element.isConnected) {
                  const cleanup = tracking.onConnected(element);
                  if (cleanup) {
                    disconnectionCleanupMap.set(element, cleanup);
                  }
                  // Clear the onConnected callback after firing once
                  tracking.onConnected = undefined;
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
              const tracking = lifecycleTracking.get(element);
              if (!tracking?.onDisconnected) continue;

              // Check if element was removed or is a descendant of removed node
              if (node === element || node.contains(element)) {
                if (!element.isConnected) {
                  // Call any cleanup function stored during connection
                  const cleanup = disconnectionCleanupMap.get(element);
                  if (cleanup) {
                    cleanup();
                    disconnectionCleanupMap.delete(element);
                  }

                  // Call disconnection callback
                  tracking.onDisconnected(element);

                  // Clean up tracking
                  lifecycleTracking.delete(element);
                  trackedElements.delete(element);
                }
              }
            }
          }
        }
      }

      // Disconnect observer if no elements are being tracked
      if (trackedElements.size === 0 && sharedObserver) {
        sharedObserver.disconnect();
        sharedObserver = null;
      }
    });

    // Observe the entire document once
    sharedObserver.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  };

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
        disconnectionCleanupMap.set(element, cleanup);
      }
      return () => {}; // No-op cleanup
    }

    // Add to shared tracking
    const tracking = lifecycleTracking.get(element) || {};
    tracking.onConnected = onConnected;
    lifecycleTracking.set(element, tracking);
    trackedElements.add(element);

    ensureSharedObserver();

    // Return cleanup function
    return () => {
      const tracking = lifecycleTracking.get(element);
      if (tracking && tracking.onConnected) {
        tracking.onConnected = undefined;

        // Remove from set if no callbacks remain
        if (!tracking.onDisconnected) {
          lifecycleTracking.delete(element);
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
    const tracking = lifecycleTracking.get(element) || {};
    tracking.onDisconnected = onDisconnected;
    lifecycleTracking.set(element, tracking);
    trackedElements.add(element);

    ensureSharedObserver();

    // Return cleanup function
    return () => {
      const tracking = lifecycleTracking.get(element);
      if (tracking && tracking.onDisconnected) {
        tracking.onDisconnected = undefined;

        // Remove from set if no callbacks remain
        if (!tracking.onConnected) {
          lifecycleTracking.delete(element);
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
