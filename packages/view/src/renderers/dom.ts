/**
 * DOM Renderer - browser implementation
 */

import type { Renderer, RendererConfig } from '../renderer';

/**
 * DOM-specific element type
 */
export type DOMElement = HTMLElement;

/**
 * DOM-specific text node type
 */
export type DOMTextNode = Text;

/**
 * Convenience type alias for DOM renderer element type
 * Use this to parameterize view factories for DOM
 */
export type DOM = DOMElement;

/**
 * DOM Renderer configuration - maps to HTML elements and events
 */
export interface DOMRendererConfig extends RendererConfig {
  elements: HTMLElementTagNameMap;
  events: HTMLElementEventMap;
  baseElement: HTMLElement;
  textNode: Text;
}

/**
 * Create a DOM renderer for browser environments
 */
export function createDOMRenderer(): Renderer<DOMRendererConfig> {
  return {
    createElement: (tag: string) => {
      return document.createElement(tag);
    },

    createTextNode: (text: string) => {
      return document.createTextNode(text);
    },

    updateTextNode: (node: DOMTextNode, text: string) => {
      node.textContent = text;
    },

    setAttribute: (element: DOMElement, key: string, value: unknown) => {
      Reflect.set(element, key, value);
    },

    appendChild: (parent: DOMElement, child: DOMElement | DOMTextNode) => {
      parent.appendChild(child as Node);
    },

    removeChild: (parent: DOMElement, child: DOMElement | DOMTextNode) => {
      parent.removeChild(child as Node);
    },

    insertBefore: (
      parent: DOMElement,
      child: DOMElement | DOMTextNode,
      reference: DOMElement | DOMTextNode | null
    ) => {
      parent.insertBefore(child as Node, reference as Node | null);
    },

    isConnected: (element: DOMElement) => {
      return element.isConnected;
    },

    isElement: (value: unknown): value is DOMElement => {
      return value instanceof HTMLElement;
    },

    addEventListener: (
      element: DOMElement,
      event: string,
      handler: (event: unknown) => void,
      options?: unknown
    ): () => void => {
      element.addEventListener(event, handler as EventListener, options as AddEventListenerOptions);
      return () => element.removeEventListener(event, handler as EventListener, options as AddEventListenerOptions);
    },
  };
}
