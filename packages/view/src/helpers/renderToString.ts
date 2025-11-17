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
export interface RenderToStringOptions {
  wrapElement?: ElementWrapper;
  wrapFragment?: FragmentWrapper;
}

/**
 * Extract HTML string from a rendered element or fragment
 *
 * @param nodeRef - The rendered node reference from mount() or create()
 * @param options - Rendering options (wrapElement, wrapFragment)
 * @returns HTML string representation
 */
export function renderToString(
  nodeRef: NodeRef<unknown>,
  options: RenderToStringOptions = {}
): string {
  if (nodeRef.status === STATUS_COMMENT) return `<!--${(nodeRef).data}-->`;
  if (nodeRef.status === STATUS_ELEMENT) return renderElementToString(nodeRef, options);
  if (nodeRef.status === STATUS_FRAGMENT) return renderFragmentToString(nodeRef, options);

  // Unknown type - return empty string
  return '';
}

/**
 * Render an element ref to HTML string
 *
 * With fragments now decorated in the DOM (via decorateFragment), we can simply
 * use outerHTML - fragment boundaries are already marked with HTML comments.
 */
function renderElementToString(
  elementRef: ElementRef<unknown>,
  options: RenderToStringOptions
): string {
  const { wrapElement } = options;
  const element = elementRef.element as { outerHTML?: string };

  if (typeof element.outerHTML !== 'string') {
    throw new Error('Element does not have outerHTML property. Are you using linkedom renderer?');
  }

  const html = element.outerHTML;
  return wrapElement ? wrapElement(html, elementRef) : html;
}

/**
 * Render a fragment ref to HTML string by concatenating all children
 *
 * Fragments don't have a DOM element, so we walk their children and concatenate.
 * Fragment boundaries are already marked in the DOM with comments (via decorateFragment).
 */
function renderFragmentToString(
  fragmentRef: FragmentRef<unknown>,
  options: RenderToStringOptions
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
