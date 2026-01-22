import type { Adapter, TreeConfig } from '../adapter';
import type { ParentContext } from '../types';
import type { SVGAttributesFor } from './svg-attributes';

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
export type OverlappingTags = keyof HTMLElementTagNameMap &
  keyof SVGElementTagNameMap;

/**
 * SVG-only tags (excluding those that overlap with HTML).
 */
type SVGOnlyTags = Exclude<keyof SVGElementTagNameMap, OverlappingTags>;

/**
 * DOM props map with style string support for HTML and SVG elements.
 * HTML types take precedence for overlapping tags (a, script, style, title).
 * SVG elements use attribute types (string/number) instead of DOM property types.
 *
 * @see https://github.com/hejhi/rimitive/issues/41
 */
export type DOMPropsMap = {
  [K in keyof HTMLElementTagNameMap]: WithStyleString<HTMLElementTagNameMap[K]>;
} & {
  [K in SVGOnlyTags]: SVGAttributesFor<K>;
} & { text: Text };

/**
 * DOM tree configuration type
 *
 * Provides type-safe attributes and nodes for standard HTML/SVG tags plus text nodes.
 *
 * @example
 * ```typescript
 * import type { DOMTreeConfig } from '@rimitive/view/adapters/dom';
 *
 * // Use in generic view types
 * type MyViewSvc = ViewSvc<DOMTreeConfig>;
 *
 * // Access node types
 * type ButtonNode = DOMTreeConfig['nodes']['button']; // HTMLButtonElement
 * type SvgNode = DOMTreeConfig['nodes']['svg']; // SVGSVGElement
 * ```
 */
export type DOMTreeConfig = TreeConfig & {
  attributes: DOMPropsMap;
  nodes: HTMLElementTagNameMap &
    Omit<SVGElementTagNameMap, OverlappingTags> & { text: Text };
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
export function createDOMAdapter(): Adapter<DOMTreeConfig> {
  return {
    createNode: <K extends keyof DOMTreeConfig['nodes'] & string>(
      type: K,
      props?: Record<string, unknown>,
      parentContext?: ParentContext<unknown>
    ): DOMTreeConfig['nodes'][K] => {
      if (type === 'text') {
        return document.createTextNode(
          props?.value != null ? String(props.value) : ''
        ) as DOMTreeConfig['nodes'][K];
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

      if (useSvgNs)
        return document.createElementNS(SVG_NS, type) as DOMTreeConfig['nodes'][K];

      return document.createElement(type) as DOMTreeConfig['nodes'][K];
    },

    setProperty: (node, key, value) => {
      const n = node as Node;
      // Text nodes only support 'value' -> textContent
      // Use nodeType check instead of instanceof for test environment compatibility
      // (happy-dom's Text class is different from global Text)
      if (n.nodeType === 3) {
        if (key === 'value') {
          (n as Text).textContent = value != null ? String(value) : '';
        }
        return;
      }

      // Element nodes (nodeType === 1)
      if (n.nodeType === 1) {
        const element = n as Element;
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

    appendChild: (parent, child) =>
      (parent as Node).appendChild(child as Node),
    removeChild: (parent, child) =>
      (parent as Node).removeChild(child as Node),
    insertBefore: (parent, child, reference) =>
      (parent as Node).insertBefore(child as Node, reference as Node | null),
  };
}
