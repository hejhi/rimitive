/**
 * ALGORITHM: Shared MutationObserver for DOM Lifecycle Tracking
 *
 * Uses FRP-style phase-based processing with status bits, similar to:
 * - pull-propagator.ts (mark + propagate phases)
 * - graph-traversal.ts (descent + unwind pattern)
 * - reconcile.ts (multiple focused passes)
 *
 * Complexity: O(mutated_nodes + marked_elements)
 * vs old approach: O(mutations × trackedElements × tree_depth)
 *
 * Pattern:
 * 1. Mark phase: Traverse mutation trees, mark affected tracked elements
 * 2. Fire phase: Process marked elements in single pass
 * 3. Cleanup: Auto-disconnect when no elements tracked
 */

export type DOMElement = HTMLElement;

// Status bits for lifecycle state (like signals CLEAN/DIRTY/PENDING)
const PENDING_CONNECT = 1 << 0;
const PENDING_DISCONNECT = 1 << 1;

/**
 * Lifecycle tracking per element
 * Includes status bits for efficient batching
 */
interface ElementTracking {
  onConnected?: (element: DOMElement) => void | (() => void);
  onDisconnected?: (element: DOMElement) => void;
  cleanup?: () => void; // Cleanup function returned by onConnected
  status: number; // Status bits for pending operations
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

  // Reusable buffer for marked elements (grow automatically, zero allocations after first use)
  const markedBuf: DOMElement[] = [];

  /**
   * Traverse element tree and mark tracked descendants
   * Recursively walks tree to find all tracked elements that need callbacks
   */
  const markTrackedDescendants = (root: Element, statusBit: number): void => {
    // Check if root is tracked
    if (root instanceof HTMLElement) {
      const rootTracking = tracking.get(root);
      if (rootTracking) {
        rootTracking.status |= statusBit;
        markedBuf.push(root);
      }
    }

    // Traverse descendants
    let child = root.firstElementChild;
    while (child) {
      markTrackedDescendants(child, statusBit);
      child = child.nextElementSibling;
    }
  };

  /**
   * Shared MutationObserver with phase-based processing
   * Phase 1: Mark affected elements
   * Phase 2: Fire callbacks for marked elements
   */
  const sharedObserver = new MutationObserver((mutations) => {
    markedBuf.length = 0; // Clear buffer (reuse array)

    // Phase 1: Mark - traverse mutation trees and mark tracked elements
    for (const mutation of mutations) {
      // Handle added nodes (connections)
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i];
        if (!(node instanceof Element)) continue;
        markTrackedDescendants(node, PENDING_CONNECT);
      }

      // Handle removed nodes (disconnections)
      for (let i = 0; i < mutation.removedNodes.length; i++) {
        const node = mutation.removedNodes[i];
        if (!(node instanceof Element)) continue;
        markTrackedDescendants(node, PENDING_DISCONNECT);
      }
    }

    // Phase 2: Fire - process marked elements in single pass
    for (const element of markedBuf) {
      const elementTracking = tracking.get(element);
      if (!elementTracking) continue;

      // Handle connection
      if (elementTracking.status & PENDING_CONNECT) {
        if (elementTracking.onConnected && element.isConnected) {
          const cleanup = elementTracking.onConnected(element);
          if (cleanup) {
            elementTracking.cleanup = cleanup;
          }
          // Clear the onConnected callback after firing once
          elementTracking.onConnected = undefined;
        }
      }

      // Handle disconnection
      if (elementTracking.status & PENDING_DISCONNECT) {
        if (elementTracking.onDisconnected && !element.isConnected) {
          // Call any cleanup function stored during connection
          if (elementTracking.cleanup) {
            elementTracking.cleanup();
            elementTracking.cleanup = undefined;
          }

          // Call disconnection callback
          elementTracking.onDisconnected(element);

          // Clean up tracking
          tracking.delete(element);
          trackedElements.delete(element);
        }
      }

      // Clear status bits for next batch
      elementTracking.status = 0;
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
        const elementTracking = tracking.get(element) || { status: 0 };
        elementTracking.cleanup = cleanup;
        tracking.set(element, elementTracking);
      }
      return () => {}; // No-op cleanup
    }

    // Add to shared tracking
    const elementTracking = tracking.get(element) || { status: 0 };
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
    const elementTracking = tracking.get(element) || { status: 0 };
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
