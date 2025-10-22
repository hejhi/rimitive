import type { LatticeExtension } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  NodeRef,
  ElRefSpecChild,
} from './types';
import {
  isReactive,
  STATUS_ELEMENT,
} from './types';
import type { ViewContext } from './context';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { CreateScopes } from './helpers/scope';

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
 * Element specification: [tag, ...propsAndChildren]
 */
export type ElRefSpec<
  Tag extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap,
  TElement = object
> = [tag: Tag, ...content: (ElementProps<Tag> | ElRefSpecChild<TElement>)[]];

/**
 * Options passed to el factory
 */
export type ElOpts<
  TElement extends RendererElement = RendererElement,
  TText extends TextNode = TextNode,
> = {
  ctx: ViewContext;
  createScope: CreateScopes['createScope'];
  runInScope: CreateScopes['runInScope'];
  trackInScope: CreateScopes['trackInScope'];
  trackInSpecificScope: CreateScopes['trackInSpecificScope'];
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  processChildren: (
    parent: TElement,
    children: ElRefSpecChild<TElement>[]
  ) => void;
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
  const {
    ctx,
    effect,
    renderer,
    processChildren,
    createScope,
    trackInScope,
    runInScope,
    trackInSpecificScope
  } = opts;

  // Create helper with captured dependencies
  const applyProps = createApplyProps({ effect, ctx, renderer, trackInScope });

  function el<Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag, TElement>
  ): RefSpec<TElement> {
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
    ref.create = <TExt>(extensions?: TExt): NodeRef<TElement> & TExt => {
      // Create the element using renderer
      const element = renderer.createElement(tag);
      // Create object with full shape at once (better for V8 hidden classes)
      const nodeRef: NodeRef<TElement> & TExt = {
        status: STATUS_ELEMENT,
        element,
        prev: undefined,
        next: undefined,
        ...extensions, // Spread extensions to override/add fields
      };

      // Create a scope optimistically (might not need it)
      const scope = createScope();

      // Run all reactive setup within this instance's scope
      runInScope(scope, () => {
        // Apply props
        applyProps(element, props);

        // Process children: build linked list and attach fragments
        processChildren(element, children);
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
function createApplyProps<
  TElement extends RendererElement,
  TText extends TextNode
>(opts: {
  effect: (fn: () => void | (() => void)) => () => void;
  ctx: ViewContext;
  renderer: Renderer<TElement, TText>;
  trackInScope: CreateScopes['trackInScope']
}) {
  const { effect, renderer, trackInScope } = opts;

  return function applyProps<Tag extends keyof HTMLElementTagNameMap>(
    element: TElement,
    props: ElementProps<Tag>
  ): void {
    for (const [key, val] of Object.entries(props)) {
      // Handle reactive values - cast to unknown first to avoid complex union
      const value = val as unknown;
      if (typeof value === 'function' && ('peek' in value || '__type' in value)) {
        const reactiveValue = value as unknown as () => unknown;
        const dispose = effect(() => renderer.setAttribute(element, key, reactiveValue()));
        // Track effect for cleanup when element is removed
        trackInScope({ dispose });
      } else renderer.setAttribute(element, key, value); // Static value
    }
  };
}

/**
 * Check if value is a plain object (not a class instance, array, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;

  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}
