import type { LatticeExtension } from '@lattice/lattice';
import type {
  ElementSpec,
  ElementProps,
  ElementChild,
  LifecycleCallback,
  ElementRef,
} from './types';
import { isReactive, isReactiveList, isElementRef } from './types';
import { createScope, runInScope, disposeScope, trackInScope } from './helpers/scope';
import type { ViewContext } from './context';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import {
  elementScopes,
  elementDisposeCallbacks,
  elementLifecycleCallbacks,
  elementCleanupCallbacks,
} from './helpers/element-metadata';

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
 */
export type ElFactory<TElement extends RendererElement = RendererElement> = LatticeExtension<
  'el',
  (spec: ElementSpec) => ElementRef<TElement>
>;

/**
 * Create the el primitive factory
 */
export function createElFactory<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  opts: ElOpts<TElement, TText>
): ElFactory<TElement> {
  const { ctx, effect, renderer } = opts;

  function el(spec: ElementSpec): ElementRef<TElement> {
    const [tag, ...rest] = spec;

    // Parse props and children from rest
    const { props, children } = parseSpec(rest);

    // Create the element using renderer
    const element = renderer.createElement(tag);

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

    // Store scope in WeakMap (cast to object for storage)
    const elementKey = element;
    elementScopes.set(elementKey, scope);

    // Store dispose callback
    elementDisposeCallbacks.set(elementKey, () => {
      disposeScope(scope);

      // Call cleanup callback if registered
      const cleanup = elementCleanupCallbacks.get(elementKey);
      if (cleanup) {
        cleanup();
        elementCleanupCallbacks.delete(elementKey);
      }
    });

    // Create the element ref - a callable function that holds the element
    const ref = ((lifecycleCallback: LifecycleCallback<TElement>): TElement => {
      // Store lifecycle callback (cast to base type for storage)
      elementLifecycleCallbacks.set(element, lifecycleCallback as LifecycleCallback<object>);

      // Observe element connection using renderer
      renderer.observeLifecycle(element, {
        onConnected: (el) => {
          return lifecycleCallback(el);
        },
        onDisconnected: () => {
          const dispose = elementDisposeCallbacks.get(element);
          if (dispose) dispose();
        }
      });

      return element;
    }) as ElementRef<TElement>;

    // Attach element to ref so it can be extracted
    ref.element = element;

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
function parseSpec(rest: (ElementProps | ElementChild)[]): {
  props: ElementProps;
  children: ElementChild[];
} {
  const props: ElementProps = {};
  const children: ElementChild[] = [];

  for (const item of rest) {
    if (isPlainObject(item) && !isReactive(item) && !isReactiveList(item)) {
      // It's props
      Object.assign(props, item);
    } else {
      // It's a child
      children.push(item);
    }
  }

  return { props, children };
}

/**
 * Apply props to element (with reactivity)
 */
function applyProps<TElement extends RendererElement, TText extends TextNode>(
  element: TElement,
  props: ElementProps,
  effect: (fn: () => void | (() => void)) => () => void,
  ctx: ViewContext,
  renderer: Renderer<TElement, TText>
): void {
  for (const [key, value] of Object.entries(props)) {
    // Handle event listeners
    if (key.startsWith('on')) {
      const eventName = key.slice(2).toLowerCase();
      const cleanup = renderer.addEventListener(element, eventName, value);
      trackInScope(ctx, { dispose: cleanup });
      continue;
    }

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

  // Element ref (from el() or elMap())
  if (isElementRef(child)) {
    renderer.appendChild(element, child.element as TElement);
    return;
  }

  // Reactive list (elMap result)
  if (isReactiveList(child)) {
    // The reactive list contains a container element
    // that will be managed by elMap's effect
    if (child.__container) {
      renderer.appendChild(element, child.__container as TElement);
    }
    return;
  }

  // Reactive value (signal or computed)
  if (isReactive(child)) {
    const textNode = renderer.createTextNode('');
    const dispose = effect(() => {
      const value = child();
      renderer.updateTextNode(textNode, String(value ?? ''));
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
function isPlainObject(value: any): value is Record<string, any> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Lifecycle observation is now handled by the renderer
