import type { Renderer, RendererConfig } from './renderer';

/**
 * DOM Renderer configuration - maps to HTML elements and events
 */
export interface DOMRendererConfig extends RendererConfig {
  elements: HTMLElementTagNameMap;
  events: HTMLElementEventMap;
}

/**
 * Browser DOM renderer implementation
 * Works with real HTMLElement and Text nodes
 */
export function createBrowserRenderer(): Renderer<DOMRendererConfig, HTMLElement, Text> {
  return {
    createElement: (tag: string) => document.createElement(tag),

    createTextNode: (text: string) => document.createTextNode(text),

    updateTextNode: (node: Text, text: string) => {
      node.textContent = text;
    },

    setAttribute: (element: HTMLElement, key: string, value: unknown) => {
      // Handle special cases
      if (key === 'className') {
        element.className = String(value);
      } else if (key === 'style' && typeof value === 'object' && value !== null) {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Event handlers
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value as EventListener);
      } else if (key in element) {
        // DOM properties
        (element as unknown as Record<string, unknown>)[key] = value;
      } else {
        // Fallback to setAttribute
        element.setAttribute(key, String(value));
      }
    },

    appendChild: (parent: HTMLElement, child: HTMLElement | Text) => {
      parent.appendChild(child);
    },

    removeChild: (parent: HTMLElement, child: HTMLElement | Text) => {
      parent.removeChild(child);
    },

    insertBefore: (parent: HTMLElement, child: HTMLElement | Text, ref: HTMLElement | Text | null) => {
      parent.insertBefore(child, ref);
    },

    isConnected: (element: HTMLElement) => element.isConnected,

    isElement: (value: unknown): value is HTMLElement =>
      value instanceof HTMLElement,

    addEventListener: (
      element: HTMLElement,
      event: string,
      handler: (event: unknown) => void,
      options?: unknown
    ) => {
      element.addEventListener(event, handler as EventListener, options as AddEventListenerOptions);
      return () => element.removeEventListener(event, handler as EventListener, options as AddEventListenerOptions);
    },
  };
}
