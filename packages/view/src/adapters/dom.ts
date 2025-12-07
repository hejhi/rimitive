import type { Adapter, AdapterConfig } from '../adapter';

/**
 * DOM adapter configuration type
 *
 * Provides type-safe props and elements for standard HTML tags plus text nodes.
 *
 * @example
 * ```typescript
 * import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
 *
 * // Use in generic view types
 * type MyViewSvc = ViewSvc<DOMAdapterConfig>;
 *
 * // Access element types
 * type ButtonElement = DOMAdapterConfig['elements']['button']; // HTMLButtonElement
 * ```
 */
export type DOMAdapterConfig = AdapterConfig & {
  props: HTMLElementTagNameMap & { text: Text };
  elements: HTMLElementTagNameMap & { text: Text };
  events: HTMLElementEventMap;
  baseElement: Node;
};

/**
 * Create a DOM adapter for browser environments
 *
 * Provides standard DOM tree operations for element creation,
 * property setting, and tree manipulation.
 *
 * @example
 * ```typescript
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import { createView } from '@lattice/view/presets/core';
 * import { createSignals } from '@lattice/signals/presets/core';
 *
 * const adapter = createDOMAdapter();
 * const signals = createSignals();
 * const view = createView(adapter, signals);
 *
 * const { el } = view;
 * const button = el('button')('Click me');
 * ```
 */
export function createDOMAdapter(): Adapter<DOMAdapterConfig> {
  return {
    createNode: (type, props) => {
      if (type === 'text') {
        return document.createTextNode(
          props?.value != null ? String(props.value) : ''
        );
      }
      return document.createElement(type);
    },

    setProperty: (node, key, value) => {
      // Text nodes only support 'value' -> textContent
      // Use nodeType check instead of instanceof for test environment compatibility
      // (happy-dom's Text class is different from global Text)
      if (node.nodeType === 3) {
        if (key === 'value') {
          (node as Text).textContent = value != null ? String(value) : '';
        }
        return;
      }

      // Element nodes (nodeType === 1)
      if (node.nodeType === 1) {
        const element = node as Element;
        // Hyphenated keys (data-*, aria-*, custom attributes) use setAttribute
        // Everything else uses property assignment for proper type handling
        if (key.includes('-')) {
          if (value == null) {
            element.removeAttribute(key);
          } else {
            element.setAttribute(key, String(value));
          }
        } else {
          Reflect.set(element, key, value);
        }
      }
    },

    appendChild: (parent, child) => parent.appendChild(child),
    removeChild: (parent, child) => parent.removeChild(child),
    insertBefore: (parent, child, reference) =>
      parent.insertBefore(child, reference),
  };
}
