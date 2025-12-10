/**
 * Island-aware renderToString for SSR
 *
 * Renders a node tree to HTML string. Islands are automatically decorated during rendering:
 * - Element islands: script tags added via decorateElement
 * - Fragment islands: wrapped in divs with script tags via decorateFragment
 *
 * Also provides async rendering support for async fragment boundaries (load()).
 */

import type {
  NodeRef,
  ElementRef,
  FragmentRef,
  RefSpec,
} from '@lattice/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  collectAsyncFragments,
  type AsyncFragment,
} from './async-fragments';

/**
 * Render a node tree to HTML string
 */
export function renderToString(nodeRef: NodeRef<unknown>): string {
  if (nodeRef.status === STATUS_ELEMENT) return renderElementToString(nodeRef);
  if (nodeRef.status === STATUS_FRAGMENT)
    return renderFragmentToString(nodeRef);
  return '';
}

function renderElementToString(elementRef: ElementRef<unknown>): string {
  const element = elementRef.element as { outerHTML?: string };
  if (typeof element.outerHTML !== 'string') {
    throw new Error(
      'Element does not have outerHTML property. Are you using linkedom renderer?'
    );
  }
  return element.outerHTML;
}

function renderFragmentToString(fragmentRef: FragmentRef<unknown>): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    parts.push(renderToString(current));
    if (current === fragmentRef.lastChild) break;
    current = current.next;
  }

  return parts.join('');
}

// =============================================================================
// Async Rendering
// =============================================================================

export type AsyncRenderable<TElement> =
  | NodeRef<TElement>
  | AsyncFragment<TElement>
  | RefSpec<TElement>;

export type RenderToStringAsyncOptions<TSvc> = {
  svc: TSvc;
  mount: (spec: RefSpec<unknown>) => NodeRef<unknown>;
  onAsyncResolved?: (id: string, data: unknown) => void;
};

function isRefSpec(value: unknown): value is RefSpec<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'create' in value &&
    typeof (value as RefSpec<unknown>).create === 'function'
  );
}

function isNodeRef(value: unknown): value is NodeRef<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const status = (value as { status?: number }).status;
  return status === STATUS_ELEMENT || status === STATUS_FRAGMENT;
}

function getFirstDOMNode(nodeRef: NodeRef<unknown>): Node | null {
  let current: NodeRef<unknown> | null = nodeRef;
  while (current) {
    if (current.status === STATUS_ELEMENT) return current.element as Node;
    if (current.status === STATUS_FRAGMENT) current = current.firstChild;
    else break;
  }
  return null;
}

function removeNodeFromDOM<TElement>(
  parentElement: Element,
  nodeRef: NodeRef<TElement>
): void {
  if (nodeRef.status === STATUS_ELEMENT && nodeRef.element) {
    parentElement.removeChild(nodeRef.element as unknown as Node);
  } else if (nodeRef.status === STATUS_FRAGMENT) {
    let child = nodeRef.firstChild;
    while (child) {
      removeNodeFromDOM(parentElement, child);
      if (child === nodeRef.lastChild) break;
      child = child.next;
    }
  }
}

function findFragmentEndMarker(startFrom: Node | null): Comment | null {
  let node = startFrom;
  while (node) {
    if (
      node.nodeType === 8 &&
      (node as Comment).textContent === 'fragment-end'
    ) {
      return node as Comment;
    }
    node = node.nextSibling;
  }
  return null;
}

function attachResolvedContent<TElement>(
  fragment: AsyncFragment<TElement>,
  nodeRef: NodeRef<TElement>
): void {
  const parentRef = fragment.parent;
  const parentElement =
    parentRef?.status === STATUS_ELEMENT
      ? (parentRef.element as unknown as Element)
      : null;

  let fragmentEndMarker: Comment | null = null;

  if (parentElement && typeof parentElement.removeChild === 'function') {
    const existingChild = fragment.firstChild;
    if (existingChild) {
      const existingFirstNode = getFirstDOMNode(existingChild);
      if (existingFirstNode) {
        fragmentEndMarker = findFragmentEndMarker(existingFirstNode);
      }
      removeNodeFromDOM(parentElement, existingChild);
    }
  }

  if (nodeRef.status === STATUS_ELEMENT || nodeRef.status === STATUS_FRAGMENT) {
    nodeRef.parent = fragment.parent;
  }

  fragment.firstChild = nodeRef;
  fragment.lastChild = nodeRef;

  if (!parentElement || typeof parentElement.insertBefore !== 'function') {
    return;
  }

  let refNode: Node | null = fragmentEndMarker;
  if (!refNode && fragment.next) {
    refNode = getFirstDOMNode(fragment.next);
  }

  if (nodeRef.status === STATUS_ELEMENT && nodeRef.element) {
    parentElement.insertBefore(nodeRef.element as unknown as Node, refNode);
  } else if (nodeRef.status === STATUS_FRAGMENT) {
    let child = nodeRef.firstChild;
    while (child) {
      if (child.status === STATUS_ELEMENT && child.element) {
        parentElement.insertBefore(child.element as unknown as Node, refNode);
      }
      if (child === nodeRef.lastChild) break;
      child = child.next;
    }
  }
}

export async function renderToStringAsync<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderToStringAsyncOptions<TSvc>
): Promise<string> {
  const { mount, onAsyncResolved } = options;

  let nodeRef: NodeRef<unknown>;

  if (isAsyncFragment(renderable)) {
    const meta = renderable[ASYNC_FRAGMENT];
    const { data, refSpec } = await meta.resolve();

    if (onAsyncResolved) {
      onAsyncResolved(meta.id, data);
    }

    nodeRef = mount(refSpec);
  } else if (isRefSpec(renderable)) {
    nodeRef = mount(renderable);
  } else if (isNodeRef(renderable)) {
    nodeRef = renderable;
  } else {
    throw new Error(
      `renderToStringAsync: unsupported renderable type. ` +
        `Expected AsyncFragment, RefSpec, or NodeRef.`
    );
  }

  const processedFragments = new Set<AsyncFragment<unknown>>();

  let asyncFragments = collectAsyncFragments(nodeRef).filter(
    (f) => !processedFragments.has(f)
  );

  while (asyncFragments.length > 0) {
    await Promise.all(
      asyncFragments.map(async (fragment) => {
        processedFragments.add(fragment);

        const meta = fragment[ASYNC_FRAGMENT];
        const { data, refSpec } = await meta.resolve();

        if (onAsyncResolved) {
          onAsyncResolved(meta.id, data);
        }

        const resolvedNodeRef = mount(refSpec);
        attachResolvedContent(fragment, resolvedNodeRef);
      })
    );

    asyncFragments = collectAsyncFragments(nodeRef).filter(
      (f) => !processedFragments.has(f)
    );
  }

  return renderToString(nodeRef);
}

// =============================================================================
// Hydration Data Serialization
// =============================================================================

export type HydrationData = Record<string, unknown>;

export function collectHydrationData(nodeRef: NodeRef<unknown>): HydrationData {
  const data: HydrationData = {};
  const fragments = collectAsyncFragments(nodeRef);

  for (const fragment of fragments) {
    const meta = fragment[ASYNC_FRAGMENT];
    const fragmentData = meta.getData();
    if (fragmentData !== undefined) {
      data[meta.id] = fragmentData;
    }
  }

  return data;
}

export function createHydrationScript(data: HydrationData): string {
  if (Object.keys(data).length === 0) {
    return '';
  }

  const json = JSON.stringify(data)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');

  return `<script>window.__LATTICE_HYDRATION_DATA__=${json}</script>`;
}

export type RenderWithHydrationOptions<TSvc> =
  RenderToStringAsyncOptions<TSvc> & {
    scriptPlacement?: 'head' | 'body' | 'inline';
  };

export type RenderWithHydrationInlineResult = {
  html: string;
  script: string;
  data: HydrationData;
};

export async function renderToStringAsyncWithHydration<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderWithHydrationOptions<TSvc> & { scriptPlacement: 'inline' }
): Promise<RenderWithHydrationInlineResult>;
export async function renderToStringAsyncWithHydration<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderWithHydrationOptions<TSvc>
): Promise<string>;
export async function renderToStringAsyncWithHydration<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderWithHydrationOptions<TSvc>
): Promise<string | RenderWithHydrationInlineResult> {
  const { scriptPlacement = 'body', ...renderOptions } = options;

  const resolvedFragments: Array<{ id: string; data: unknown }> = [];

  const html = await renderToStringAsync(renderable, {
    ...renderOptions,
    onAsyncResolved: (id, data) => {
      if (data !== undefined) {
        resolvedFragments.push({ id, data });
      }
      options.onAsyncResolved?.(id, data);
    },
  });

  const data: HydrationData = {};
  for (const { id, data: fragmentData } of resolvedFragments) {
    data[id] = fragmentData;
  }

  const script = createHydrationScript(data);

  if (scriptPlacement === 'inline') {
    return { html, script, data };
  }

  if (!script) {
    return html;
  }

  if (scriptPlacement === 'head') {
    return html.replace('</head>', `${script}</head>`);
  }

  return html.replace('</body>', `${script}</body>`);
}
