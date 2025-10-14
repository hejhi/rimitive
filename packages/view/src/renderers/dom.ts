/**
 * DOM Renderer - browser implementation
 */

import type { Renderer, LifecycleCallbacks } from '../renderer';

/**
 * DOM-specific element type
 */
export type DOMElement = HTMLElement;

/**
 * DOM-specific text node type
 */
export type DOMTextNode = Text;

/**
 * Create a DOM renderer for browser environments
 */
export function createDOMRenderer(): Renderer<DOMElement, DOMTextNode> {
  return {
    createElement(tag: string): DOMElement {
      return document.createElement(tag);
    },

    createContainer(): DOMElement {
      const container = document.createElement('div');
      container.style.display = 'contents';
      return container;
    },

    createTextNode(text: string): DOMTextNode {
      return document.createTextNode(text);
    },

    updateTextNode(node: DOMTextNode, text: string): void {
      node.textContent = text;
    },

    setAttribute(element: DOMElement, key: string, value: unknown): void {
      Reflect.set(element, key, value);
    },

    appendChild(parent: DOMElement, child: DOMElement | DOMTextNode): void {
      parent.appendChild(child as Node);
    },

    removeChild(parent: DOMElement, child: DOMElement | DOMTextNode): void {
      parent.removeChild(child as Node);
    },

    insertBefore(
      parent: DOMElement,
      child: DOMElement | DOMTextNode,
      reference: DOMElement | DOMTextNode | null
    ): void {
      parent.insertBefore(child as Node, reference as Node | null);
    },

    addEventListener(
      element: DOMElement,
      event: string,
      handler: (...args: unknown[]) => void
    ): () => void {
      element.addEventListener(event, handler);
      return () => element.removeEventListener(event, handler);
    },

    observeLifecycle(element: DOMElement, callbacks: LifecycleCallbacks<DOMElement>): () => void {
      const { onConnected, onDisconnected } = callbacks;

      // If already connected, call immediately
      if (element.isConnected && onConnected) {
        const cleanup = onConnected(element);
        if (cleanup) {
          // Store cleanup for disconnection
          const cleanupMap = disconnectionCleanupMap;
          cleanupMap.set(element, cleanup);
        }
      }

      // Set up observers for connection/disconnection
      const connectObserver = observeConnection(element, onConnected);
      const disconnectObserver = observeDisconnection(element, onDisconnected);

      // Return cleanup function
      return () => {
        connectObserver();
        disconnectObserver();
      };
    },

    isConnected(element: DOMElement): boolean {
      return element.isConnected;
    },

    isElement(value: unknown): value is DOMElement {
      return value instanceof HTMLElement;
    },

    isTextNode(value: unknown): value is DOMTextNode {
      return value instanceof Text;
    },
  };
}

/**
 * Store cleanup functions for disconnection
 */
const disconnectionCleanupMap = new WeakMap<DOMElement, () => void>();

/**
 * Shared lifecycle tracking - single MutationObserver for all elements
 */
interface LifecycleTracking {
  onConnected?: (element: DOMElement) => void | (() => void);
  onDisconnected?: (element: DOMElement) => void;
}

const lifecycleTracking = new WeakMap<DOMElement, LifecycleTracking>();
const trackedElements = new Set<DOMElement>();
let sharedObserver: MutationObserver | null = null;

/**
 * Initialize the shared MutationObserver (lazy)
 */
function ensureSharedObserver(): void {
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
}

/**
 * Observe when an element is connected to the DOM
 */
function observeConnection(
  element: DOMElement,
  onConnected?: (element: DOMElement) => void | (() => void)
): () => void {
  if (!onConnected) {
    return () => {}; // No-op cleanup
  }

  // If already connected, call immediately
  if (element.isConnected) {
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
}

/**
 * Observe when an element is disconnected from the DOM
 */
function observeDisconnection(
  element: DOMElement,
  onDisconnected?: (element: DOMElement) => void
): () => void {
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
}
