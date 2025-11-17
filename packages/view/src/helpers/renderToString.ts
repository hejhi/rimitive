/**
 * Server-side rendering utilities for extracting HTML from linkedom elements
 */

import type { NodeRef, ElementRef, FragmentRef } from '../types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_COMMENT } from '../types';

/**
 * Element wrapper function type
 * Allows customizing how elements are wrapped in the output HTML
 */
export type ElementWrapper = (html: string, elementRef: ElementRef<unknown>) => string;

/**
 * Fragment wrapper function type
 * Allows customizing how fragments are wrapped in the output HTML
 */
export type FragmentWrapper = (html: string, fragmentRef: FragmentRef<unknown>) => string;

/**
 * Options for renderToString
 */
export interface RenderToStringOptions<TElement = unknown> {
  renderer: { serializeElement: (element: TElement, childrenHTML: string) => string };
  wrapElement?: ElementWrapper;
  wrapFragment?: FragmentWrapper;
}

/**
 * Extract HTML string from a rendered element or fragment
 *
 * @param nodeRef - The rendered node reference from mount() or create()
 * @param options - Rendering options (renderer, wrapElement, wrapFragment)
 * @returns HTML string representation
 */
export function renderToString<TElement = unknown>(
  nodeRef: NodeRef<unknown>,
  options: RenderToStringOptions<TElement>
): string {
  if (nodeRef.status === STATUS_COMMENT) return `<!--${(nodeRef).data}-->`;
  if (nodeRef.status === STATUS_ELEMENT) return renderElementToString(nodeRef, options);
  if (nodeRef.status === STATUS_FRAGMENT) return renderFragmentToString(nodeRef, options);

  // Unknown type - return empty string
  return '';
}

/**
 * Check if element or any descendant has fragment children (recursive check)
 */
function hasFragmentDescendants(elementRef: ElementRef<unknown>): boolean {
  if (!elementRef.firstChild) return false;

  let current: typeof elementRef.firstChild | null = elementRef.firstChild;

  while (current) {
    if (current.status === STATUS_FRAGMENT) return true;
    if (current.status === STATUS_ELEMENT && hasFragmentDescendants(current)) return true;
    if (current === elementRef.lastChild) break;

    current = current.next;
  }

  return false;
}

/**
 * Render an element ref to HTML string
 *
 * Only walks the NodeRef tree if there are fragment descendants.
 * Otherwise uses outerHTML to preserve all DOM content including text nodes.
 */
function renderElementToString<TElement = unknown>(
  elementRef: ElementRef<unknown>,
  options: RenderToStringOptions<TElement>
): string {
  const { renderer, wrapElement } = options;
  const element = elementRef.element as { outerHTML?: string };

  if (typeof element.outerHTML !== 'string') {
    throw new Error('Element does not have outerHTML property. Are you using linkedom renderer?');
  }

  // If no fragment descendants anywhere, use outerHTML (fastest, preserves all DOM content)
  if (!hasFragmentDescendants(elementRef)) {
    const html = element.outerHTML;
    return wrapElement ? wrapElement(html, elementRef) : html;
  }

  // Has fragment descendants - need to walk tree to wrap them properly
  const childParts: string[] = [];
  let current: typeof elementRef.firstChild | null = elementRef.firstChild;

  while (current) {
    if (current.status === STATUS_FRAGMENT) {
      childParts.push(renderFragmentToString(current, options));
    } else {
      childParts.push(renderToString(current, options));
    }

    if (current === elementRef.lastChild) break;
    current = current.next;
  }

  // Use renderer to serialize element with walked children
  const html = renderer.serializeElement(element as TElement, childParts.join(''));
  return wrapElement ? wrapElement(html, elementRef) : html;
}

/**
 * Render a fragment ref to HTML string by concatenating all children
 */
function renderFragmentToString<TElement = unknown>(
  fragmentRef: FragmentRef<unknown>,
  options: RenderToStringOptions<TElement>
): string {
  const { wrapFragment } = options;
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    parts.push(renderToString(current, options));

    if (current === fragmentRef.lastChild) break;
    current = current.next;
  }

  const stringified = parts.join('');

  // Apply custom wrapper if provided
  if (wrapFragment) return wrapFragment(stringified, fragmentRef);

  return stringified;
}
