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

    createTextNode(text: string): DOMTextNode {
      return document.createTextNode(text);
    },

    updateTextNode(node: DOMTextNode, text: string): void {
      node.textContent = text;
    },

    setAttribute(element: DOMElement, key: string, value: any): void {
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
      handler: (...args: any[]) => void
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

    isElement(value: any): value is DOMElement {
      return value instanceof HTMLElement;
    },

    isTextNode(value: any): value is DOMTextNode {
      return value instanceof Text;
    },
  };
}

/**
 * Store cleanup functions for disconnection
 */
const disconnectionCleanupMap = new WeakMap<DOMElement, () => void>();

/**
 * Observe when an element is connected to the DOM
 */
function observeConnection(
  element: DOMElement,
  onConnected?: (element: DOMElement) => void | (() => void)
): () => void {
  if (!onConnected || element.isConnected) {
    return () => {}; // No-op cleanup
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const addedNodes = Array.from(mutation.addedNodes);
      for (const node of addedNodes) {
        if (node === element || (node instanceof Element && node.contains(element))) {
          // Element was connected
          const cleanup = onConnected(element);
          if (cleanup) {
            disconnectionCleanupMap.set(element, cleanup);
          }

          // Stop observing for connection
          observer.disconnect();
          return;
        }
      }
    }
  });

  // Observe the entire document for additions
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
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

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const removedNodes = Array.from(mutation.removedNodes);
      for (const node of removedNodes) {
        if (node === element || (node instanceof Element && node.contains(element))) {
          // Call any cleanup function stored during connection
          const cleanup = disconnectionCleanupMap.get(element);
          if (cleanup) {
            cleanup();
            disconnectionCleanupMap.delete(element);
          }

          // Call disconnection callback
          onDisconnected(element);

          // Stop observing
          observer.disconnect();
          return;
        }
      }
    }
  });

  // Observe the document for removals
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}
