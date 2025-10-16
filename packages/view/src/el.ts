import type { LatticeExtension } from '@lattice/lattice';
import type {
  ElementSpec,
  ElementProps,
  ElementChild,
  LifecycleCallback,
  ElementRef,
} from './types';
import { isReactive, isFragment, isElementRef } from './types';
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

    // Parse props and children from rest (blueprint data)
    const { props, children } = parseSpec(rest);

    // Store lifecycle callbacks that will be applied to each instance
    const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

    // Create ref function for registering lifecycle callbacks
    const ref = ((lifecycleCallback: LifecycleCallback<TElement>): ElementRef<TElement> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return ref; // Chainable
    }) as ElementRef<TElement>;

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

        // Handle children
        for (const child of children) {
          handleChild(element, child, effect, ctx, renderer);
        }
      });

      // Store scope in context WeakMap (for cleanup)
      ctx.elementScopes.set(element, scope);

      // Set up lifecycle observer for THIS instance
      const lifecycleDispose = renderer.observeLifecycle(element, {
        onConnected: (el) => {
          // Run all registered callbacks for this instance
          for (const callback of lifecycleCallbacks) {
            const cleanup = callback(el);
            if (cleanup) {
              trackInSpecificScope(scope, { dispose: cleanup });
            }
          }
        },
        onDisconnected: () => {
          // Look up scope and dispose
          const elementScope = ctx.elementScopes.get(element);
          if (elementScope) {
            disposeScope(elementScope);
            ctx.elementScopes.delete(element);
          }
        }
      });

      // Track lifecycle observer disposal in element's scope
      trackInSpecificScope(scope, { dispose: lifecycleDispose });

      return element;
    };

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
    if (isPlainObject(item) && !isReactive(item) && !isFragment(item)) {
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

  // Element ref (from el()) - instantiate blueprint
  if (isElementRef(child)) {
    renderer.appendChild(element, child.create());
    return;
  }

  // Fragment (from map() or match()) - call it with parent element
  if (isFragment(child)) {
    child(element); // ← Attach fragment to parent element
    return;
  }

  // Reactive value (signal or computed)
  if (isReactive(child)) {
    const textNode = renderer.createTextNode('');
    const dispose = effect(() => {
      const value = child();
      // Convert to string, handling null/undefined and primitives only
      let stringValue = '';
      if (value != null) stringValue = String(value);
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
