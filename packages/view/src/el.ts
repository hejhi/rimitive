import type { LatticeExtension } from '@lattice/lattice';
import type {
  ElementSpec,
  ElementProps,
  ElementChild,
  LifecycleCallback,
  ElementRef,
} from './types';
import { isReactive, isDeferredListRef, isElementRef, ELEMENT_REF, type ElementNode } from './types';
import { createScope, runInScope, disposeScope, trackInScope, trackInSpecificScope } from './helpers/scope';
import type { ViewContext } from './context';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';

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
export type ElFactory<TElement extends RendererElement = RendererElement> = LatticeExtension<
  'el',
  <Tag extends keyof HTMLElementTagNameMap>(
    spec: ElementSpec<Tag>
  ) => ElementRef<TElement extends HTMLElement ? HTMLElementTagNameMap[Tag] : TElement>
>;

/**
 * Create the el primitive factory
 */
export function createElFactory<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  opts: ElOpts<TElement, TText>
): ElFactory<TElement> {
  const { ctx, effect, renderer } = opts;

  function el<Tag extends keyof HTMLElementTagNameMap>(spec: ElementSpec<Tag>): ElementRef<TElement> {
    const [tag, ...rest] = spec;

    // Parse props and children from rest
    const { props, children } = parseSpec(rest);

    // Create the element using renderer
    const element = renderer.createElement(tag);

    // PATTERN: Create internal node (like signals creates SignalNode)
    const node: ElementNode<TElement> = {
      refType: ELEMENT_REF,
      element,
    };

    // Create a minimal disposal scope
    const scope = createScope();

    // Run all reactive setup within this scope
    runInScope(ctx, scope, () => {
      // Apply props
      applyProps(element, props, effect, ctx, renderer);

      // Handle children
      for (const child of children) {
        handleChild(element, child, effect, ctx, renderer);
      }
    });

    // Store scope in context WeakMap (only lookup needed)
    ctx.elementScopes.set(element, scope);

    // PATTERN: Create ref function that closes over node (like signal function)
    const ref = ((lifecycleCallback: LifecycleCallback<TElement>): TElement => {
      // Observe element connection using renderer
      // PATTERN: Lifecycle cleanup tracked as disposable in element's scope
      const lifecycleDispose = renderer.observeLifecycle(node.element, {
        onConnected: (el) => {
          const cleanup = lifecycleCallback(el);
          // Track cleanup as disposable in element's scope (not currentScope)
          if (cleanup) {
            trackInSpecificScope(scope, { dispose: cleanup });
          }
          return cleanup;
        },
        onDisconnected: () => {
          // ALGORITHMIC: Look up scope and dispose via tree walk
          const elementScope = ctx.elementScopes.get(node.element);
          if (elementScope) {
            disposeScope(elementScope);
            ctx.elementScopes.delete(node.element);
          }
        }
      });

      // Track lifecycle observer disposal in element's scope
      trackInSpecificScope(scope, { dispose: lifecycleDispose });

      return node.element;
    }) as ElementRef<TElement>;

    // Attach node to ref (internal state, exposed for helpers)
    ref.node = node;

    return ref;
  }

  return {
    name: 'el',
    method: el as ElFactory<TElement>['method'],
  };
}

/**
 * Parse element spec into props and children
 */
function parseSpec<Tag extends keyof HTMLElementTagNameMap>(
  rest: (ElementProps<Tag> | ElementChild)[]
): {
  props: ElementProps<Tag>;
  children: ElementChild[];
} {
  const props = {} as ElementProps<Tag>;
  const children: ElementChild[] = [];

  for (const item of rest) {
    if (isPlainObject(item) && !isReactive(item) && !isDeferredListRef(item)) {
      // It's props
      Object.assign(props, item);
    } else {
      // It's a child - not a plain object props, so must be ElementChild
      children.push(item as ElementChild);
    }
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
      const dispose = effect(() => {
        renderer.setAttribute(element, key, value());
      });
      // Track effect for cleanup when element is removed
      trackInScope(ctx, { dispose });
    } else {
      // Static value
      renderer.setAttribute(element, key, value);
    }
  }
}

/**
 * Handle a single child (static, reactive, or reactive list)
 */
function handleChild<TElement extends RendererElement, TText extends TextNode>(
  element: TElement,
  child: ElementChild,
  effect: (fn: () => void | (() => void)) => () => void,
  ctx: ViewContext,
  renderer: Renderer<TElement, TText>
): void {
  // Skip null/undefined/false
  if (child == null || child === false) {
    return;
  }

  // Element ref (from el())
  if (isElementRef(child)) {
    renderer.appendChild(element, child.node.element);
    return;
  }

  // Deferred list ref (from elMap()) - call it with parent element
  if (isDeferredListRef(child)) {
    child(element); // ← Provide parent element, elMap renders directly into it
    return;
  }

  // Reactive value (signal or computed)
  if (isReactive(child)) {
    const textNode = renderer.createTextNode('');
    const dispose = effect(() => {
      const value = child();
      // Convert to string, handling null/undefined and primitives only
      let stringValue = '';
      if (value != null) {
        stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
      }
      renderer.updateTextNode(textNode, stringValue);
    });
    // Track effect for cleanup when element is removed
    trackInScope(ctx, { dispose });
    renderer.appendChild(element, textNode);
    return;
  }

  // Element (check using renderer)
  if (renderer.isElement(child)) {
    renderer.appendChild(element, child);
    return;
  }

  // Static primitive (string, number)
  if (typeof child === 'string' || typeof child === 'number') {
    const textNode = renderer.createTextNode(String(child));
    renderer.appendChild(element, textNode);
    return;
  }

  // Boolean - ignore
  if (typeof child === 'boolean') {
    return;
  }
}

/**
 * Check if value is a plain object (not a class instance, array, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

// Lifecycle observation is now handled by the renderer
