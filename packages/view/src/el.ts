import type { LatticeExtension } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  FragmentSpec,
  NodeRef,
  ElementRef,
} from './types';
import {
  isReactive,
  isRefSpec,
  isElementRef,
  isFragmentRef,
  STATUS_ELEMENT,
} from './types';
import { createScope, runInScope, trackInScope, trackInSpecificScope } from './helpers/scope';
import type { ViewContext } from './context';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';

/**
 * Makes each property in T accept either the value or a Reactive<value>
 */
type ReactiveProps<T> = {
  [K in keyof T]?: T[K] | Reactive<T[K]>;
};

/**
 * Props for an element - type-safe based on the HTML tag
 * Each prop can be either a static value or a Reactive value
 * Includes all standard HTML properties and ARIA properties in camelCase (ariaLabel, ariaHidden, etc.)
 */
export type ElementProps<Tag extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> =
  ReactiveProps<HTMLElementTagNameMap[Tag]> & {
    style?: Partial<CSSStyleDeclaration>;
  };

/**
 * Valid child types for an element
 * Generic over element type for proper FragmentSpec typing
 */
export type ElRefSpecChild<TElement = object> =
  | string
  | number
  | boolean
  | null
  | RefSpec<TElement>
  | Reactive<unknown>
  | FragmentSpec<TElement>;

/**
 * Element specification: [tag, ...propsAndChildren]
 */
export type ElRefSpec<
  Tag extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap,
  TElement = object
> = [tag: Tag, ...content: (ElementProps<Tag> | ElRefSpecChild<TElement>)[]];

/**
 * Options passed to el factory
 */
export type ElOpts<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode> = {
  ctx: ViewContext;
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
};

/**
 * Factory return type
 * Generic over element type
 *
 * IMPORTANT: When using with HTMLElement, this automatically returns specific HTML element types.
 * Example: ElFactory<HTMLElement> returns HTMLButtonElement for el(['button', ...])
 *
 * This works because HTMLElement has an index signature that maps to HTMLElementTagNameMap.
 */
export type ElFactory<TElement extends RendererElement = RendererElement> =
  LatticeExtension<
    'el',
    <Tag extends keyof HTMLElementTagNameMap>(
      spec: ElRefSpec<Tag, TElement>
    ) => RefSpec<TElement>
  >;

/**
 * Create the el primitive factory
 */
export function createElFactory<TElement extends RendererElement, TText extends TextNode = TextNode>(
  opts: ElOpts<TElement, TText>
): ElFactory<TElement> {
  const { ctx, effect, renderer } = opts;

  function el<Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag, TElement>
  ) {
    const [tag, ...rest] = spec;

    // Store lifecycle callbacks that will be applied to each instance
    const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

    // Parse props and children from rest (blueprint data)
    const { props, children } = parseSpec(rest);

    // Create ref function for registering lifecycle callbacks
    const ref = ((
      lifecycleCallback: LifecycleCallback<TElement>
    ): RefSpec<TElement> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return ref; // Chainable
    }) as RefSpec<TElement>;

    // Factory function - creates a new instance each time
    ref.create = (): NodeRef<TElement> => {
      // Create the element using renderer
      const element = renderer.createElement(tag);
      const nodeRef: ElementRef<TElement> = {
        element,
        status: STATUS_ELEMENT,
        prev: undefined,
        next: undefined,
      };

      // Create a scope optimistically (might not need it)
      const scope = createScope();

      // Run all reactive setup within this instance's scope
      runInScope(ctx, scope, () => {
        // Apply props
        applyProps(element, props, effect, ctx, renderer);

        // Track tail of intrusive linked list (traverse backwards from here)
        let lastChildRef: NodeRef<TElement> | undefined;

        for (const child of children) {
          // Build: process children forward
          const refNode = handleChild(element, child, effect, ctx, renderer);

          if (!refNode) continue;
          if (lastChildRef) {
            lastChildRef.next = refNode;
            refNode.prev = lastChildRef;
          }
          lastChildRef = refNode;
        }

        // Unwind: traverse backwards and attach fragments
        if (!lastChildRef) return;
        let nextElement: TElement | null = null;

        do {
          if (isFragmentRef(lastChildRef))
            lastChildRef.attach(element, nextElement);
          else nextElement = lastChildRef.element;

          lastChildRef = lastChildRef.prev;
        } while (lastChildRef);
      });

      // Run lifecycle callbacks immediately (no MutationObserver needed)
      // Cleanup happens via scope disposal when element is removed by reconciler
      for (const callback of lifecycleCallbacks) {
        const cleanup = callback(element);
        if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
      }

      // Lazy scope creation: only store scope if it actually has disposables
      // This saves memory for static elements with no reactive content
      if (scope.firstDisposable !== undefined) {
        ctx.elementScopes.set(element, scope);
      }

      // Return just the element (ref nodes were internal implementation detail)
      return nodeRef;
    };

    return ref;
  }

  return {
    name: 'el',
    method: el,
  };
}

/**
 * Parse element spec into props and children
 */
function parseSpec<Tag extends keyof HTMLElementTagNameMap, TElement>(
  rest: (ElementProps<Tag> | ElRefSpecChild<TElement>)[]
): {
  props: ElementProps<Tag>;
  children: ElRefSpecChild<TElement>[];
} {
  const props = {} as ElementProps<Tag>;
  const children: ElRefSpecChild<TElement>[] = [];
  
  for (const item of rest) {
    // It's props
    if (isPlainObject(item) && !isReactive(item)) Object.assign(props, item);
    // It's a child - not a plain object props, so must be RefSpecChild
    else children.push(item);
  }

  return { props, children };
}

/**
 * Apply props to element (with reactivity)
 */
function applyProps<
  Tag extends keyof HTMLElementTagNameMap,
  TElement extends RendererElement,
  TText extends TextNode
>(
  element: TElement,
  props: ElementProps<Tag>,
  effect: (fn: () => void | (() => void)) => () => void,
  ctx: ViewContext,
  renderer: Renderer<TElement, TText>
): void {
  for (const [key, value] of Object.entries(props)) {
    // Handle reactive values
    if (isReactive(value)) {
      const dispose = effect(() => renderer.setAttribute(element, key, value()));
      // Track effect for cleanup when element is removed
      trackInScope(ctx, { dispose });
    } else renderer.setAttribute(element, key, value); // Static value
  }
}

/**
 * Handle a single child (static, reactive, or reactive list)
 * Returns a NodeRef for elements/fragments that need sibling tracking
 */
function handleChild<TElement extends RendererElement, TText extends TextNode>(
  element: TElement,
  child: ElRefSpecChild<TElement>,
  effect: (fn: () => void | (() => void)) => () => void,
  ctx: ViewContext,
  renderer: Renderer<TElement, TText>
): NodeRef<TElement> | null {
  // Skip null/undefined/false
  if (child == null || child === false) return null;
  if (typeof child === 'function') {
    // Element ref (from el()) - instantiate blueprint
    if (isRefSpec<TElement>(child)) {
      const childRef = child.create();

      // Append element if this is an ElementRef (fragments get attached later)
      if (isElementRef(childRef)) {
        renderer.appendChild(element, childRef.element);
      }

      return childRef;
    }

    // The only other functions allowed are reactives
    if (isReactive(child)) {
      // Reactive value (signal or computed) - check BEFORE FragmentSpec
      // since reactive values are also functions without .create()
      const textNode = renderer.createTextNode('');
      const dispose = effect(() => {
        const value = child();
        // Convert to string, handling null/undefined and primitives only
        let stringValue = '';
        if (value != null) stringValue = String(value as unknown as string); // for linting
        renderer.updateTextNode(textNode, stringValue);
      });

      // Track effect for cleanup when element is removed
      trackInScope(ctx, { dispose });
      renderer.appendChild(element, textNode);
      return null; // Text nodes don't participate in ref node chain
    }
  }

  // Element (check using renderer)
  if (renderer.isElement(child)) {
    renderer.appendChild(element, child);
    return null; // Raw elements don't participate in ref node chain
  }

  // Static primitive (string, number)
  if (typeof child === 'string' || typeof child === 'number') {
    const textNode = renderer.createTextNode(String(child));
    renderer.appendChild(element, textNode);
    return null; // Text nodes don't participate in ref node chain
  }

  // Boolean - ignore
  if (typeof child === 'boolean') return null;

  return null; // Default case
}

/**
 * Check if value is a plain object (not a class instance, array, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;

  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}
