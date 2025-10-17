import type { LatticeExtension } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  ReactiveElement,
  Reactive,
  FragmentSpec,
} from './types';
import {
  isReactive,
  isRefSpec,
} from './types';
import { createScope, runInScope, disposeScope, trackInScope, trackInSpecificScope } from './helpers/scope';
import type { ViewContext } from './context';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';

/**
 * Element ref node - wraps created elements for sibling tracking
 */
interface ElementRef<TElement> {
  element: TElement;
  prev?: NodeRef<TElement>;
  next?: NodeRef<TElement>;
}

/**
 * Fragment ref node - wraps fragments for deferred attachment
 */
interface FragmentRef<TElement> {
  element: null;
  prev?: NodeRef<TElement>;
  next?: NodeRef<TElement>;
  attach: (parent: TElement, nextSibling: TElement | null) => void;
}

/**
 * Ref node - union of element/fragment tracking nodes
 */
type NodeRef<TElement> = ElementRef<TElement> | FragmentRef<TElement>;

/**
 * Props for an element - type-safe based on the HTML tag
 */
export type ElementProps<Tag extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> =
  Partial<HTMLElementTagNameMap[Tag]> & {
    style?: Partial<CSSStyleDeclaration>;
  };

/**
 * Element specification: [tag, ...propsAndChildren]
 */
export type ElRefSpec<
  Tag extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap,
> = [tag: Tag, ...content: (ElementProps<Tag> | ElRefSpecChild)[]];

/**
 * Valid child types for an element
 */
export type ElRefSpecChild =
  | string
  | number
  | boolean
  | null
  | ReactiveElement
  | RefSpec
  | Reactive<string | number>
  | FragmentSpec;

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
      spec: ElRefSpec<Tag>
    ) => RefSpec<
      TElement extends HTMLElement ? HTMLElementTagNameMap[Tag] : TElement
    >
  >;

/**
 * Create the el primitive factory
 */
export function createElFactory<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  opts: ElOpts<TElement, TText>
): ElFactory<TElement> {
  const { ctx, effect, renderer } = opts;

  function el<Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag>
  ): RefSpec<TElement> {
    const [tag, ...rest] = spec;

    // Store lifecycle callbacks that will be applied to each instance
    const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

    // Create ref function for registering lifecycle callbacks
    const ref = ((
      lifecycleCallback: LifecycleCallback<TElement>
    ): RefSpec<TElement> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return ref; // Chainable
    }) as RefSpec<TElement>;

    // Parse props and children from rest (blueprint data)
    const { props, children } = parseSpec(rest);

    // Factory function - creates a new instance each time
    ref.create = (): TElement => {
      // Create the element using renderer
      const element = renderer.createElement(tag);

      // Create a scope for this instance
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
          if ('attach' in lastChildRef) lastChildRef.attach(element, nextElement);
          else nextElement = lastChildRef.element;

          lastChildRef = lastChildRef.prev;
        } while (lastChildRef);
      });

      // Store scope in context WeakMap (for cleanup)
      ctx.elementScopes.set(element, scope);

      // Set up lifecycle observer for THIS instance
      const lifecycleDispose = renderer.observeLifecycle(element, {
        onConnected: (el) => {
          // Run all registered callbacks for this instance
          for (const callback of lifecycleCallbacks) {
            const cleanup = callback(el);
            if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
          }
        },
        onDisconnected: () => {
          // Look up scope and dispose
          const elementScope = ctx.elementScopes.get(element);
          if (elementScope) {
            disposeScope(elementScope);
            ctx.elementScopes.delete(element);
          }
        },
      });

      // Track lifecycle observer disposal in element's scope
      trackInSpecificScope(scope, { dispose: lifecycleDispose });

      // Return just the element (ref nodes were internal implementation detail)
      return element;
    };

    return ref;
  }

  return {
    name: 'el',
    method: el as unknown as ElFactory<TElement>['method'],
  };
}

/**
 * Parse element spec into props and children
 */
function parseSpec<Tag extends keyof HTMLElementTagNameMap>(
  rest: (ElementProps<Tag> | ElRefSpecChild)[]
): {
  props: ElementProps<Tag>;
  children: ElRefSpecChild[];
} {
  const props = {} as ElementProps<Tag>;
  const children: ElRefSpecChild[] = [];
  
  for (const item of rest) {
    // It's props
    if (isPlainObject(item) && !isReactive(item)) Object.assign(props, item);
    // It's a child - not a plain object props, so must be RefSpecChild
    else children.push(item as ElRefSpecChild);
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
  child: ElRefSpecChild,
  effect: (fn: () => void | (() => void)) => () => void,
  ctx: ViewContext,
  renderer: Renderer<TElement, TText>
): NodeRef<TElement> | null {
  // Skip null/undefined/false
  if (child == null || child === false) return null;
  if (typeof child === 'function') {
    // Element ref (from el()) - instantiate blueprint
    if (isRefSpec<TElement>(child)) {
      const childElement = child.create();
      renderer.appendChild(element, childElement);
      // Wrap in ref node for internal sibling tracking
      return {
        element: childElement,
        prev: undefined,
        next: undefined,
      };
    }

    // The only other functions allowed are reactives or fragments
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

    // Fragment (from map() or match()) - defer attachment, return ref node
    const fragment = child;
    const fragmentRefNode: FragmentRef<TElement> = {
      element: null,
      prev: undefined,
      next: undefined,
      attach: fragment, // Fragment is already the right signature
    } as FragmentRef<TElement>;
    return fragmentRefNode;
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
