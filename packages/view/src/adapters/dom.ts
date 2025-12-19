import type { Adapter, AdapterConfig } from '../adapter';

/** SVG namespace URI */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Override style property to accept both string and CSSStyleDeclaration.
 * This matches real DOM behavior where setting element.style = "..." sets cssText.
 */
type WithStyleString<T> = T extends { style: CSSStyleDeclaration }
  ? Omit<T, 'style'> & { style?: string | CSSStyleDeclaration }
  : T;

/**
 * Tags that exist in both HTML and SVG with incompatible types.
 * We prefer HTML types for these since they're more commonly used outside SVG context.
 */
type OverlappingTags = keyof HTMLElementTagNameMap & keyof SVGElementTagNameMap;

/**
 * DOM props map with style string support for HTML and SVG elements.
 * HTML types take precedence for overlapping tags (a, script, style, title).
 */
type DOMPropsMap = {
  [K in keyof HTMLElementTagNameMap]: WithStyleString<HTMLElementTagNameMap[K]>;
} & {
  [K in Exclude<keyof SVGElementTagNameMap, OverlappingTags>]: SVGElementTagNameMap[K];
} & { text: Text };

/**
 * DOM adapter configuration type
 *
 * Provides type-safe props and elements for standard HTML/SVG tags plus text nodes.
 *
 * @example
 * ```typescript
 * import type { DOMAdapterConfig } from '@rimitive/view/adapters/dom';
 *
 * // Use in generic view types
 * type MyViewSvc = ViewSvc<DOMAdapterConfig>;
 *
 * // Access element types
 * type ButtonElement = DOMAdapterConfig['elements']['button']; // HTMLButtonElement
 * type SvgElement = DOMAdapterConfig['elements']['svg']; // SVGSVGElement
 * ```
 */
export type DOMAdapterConfig = AdapterConfig & {
  props: DOMPropsMap;
  elements: HTMLElementTagNameMap &
    Omit<SVGElementTagNameMap, OverlappingTags> & { text: Text };
  events: HTMLElementEventMap & SVGElementEventMap;
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
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 * import { createElModule } from '@rimitive/view/el';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(SignalModule, ComputedModule, EffectModule, createElModule(adapter));
 *
 * const { el } = svc;
 * const button = el('button')('Click me');
 * ```
 */
export function createDOMAdapter(): Adapter<DOMAdapterConfig> {
  return {
    createNode: (type, props, parentContext) => {
      if (type === 'text') {
        return document.createTextNode(
          props?.value != null ? String(props.value) : ''
        );
      }

      // Determine SVG namespace from parent context
      const parentElement = parentContext?.element as Element | undefined;
      const parentIsSvg = parentElement?.namespaceURI === SVG_NS;
      const parentIsForeignObject =
        parentElement?.localName === 'foreignObject';

      // Use SVG namespace if:
      // 1. Creating an <svg> element (root SVG)
      // 2. Parent is SVG and NOT foreignObject (foreignObject children are HTML)
      const useSvgNs =
        type === 'svg' || (parentIsSvg && !parentIsForeignObject);

      if (useSvgNs) return document.createElementNS(SVG_NS, type);

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
        const isSvg = element.namespaceURI === SVG_NS;
        const isEventHandler = key.startsWith('on');

        // SVG elements: use setAttribute for all non-event properties
        // This preserves case-sensitivity (viewBox, preserveAspectRatio)
        // HTML hyphenated: use setAttribute (data-*, aria-*, custom)
        // HTML non-hyphenated: use property assignment
        if ((isSvg && !isEventHandler) || key.includes('-')) {
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
