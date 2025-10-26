import type { LatticeExtension } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  ElementRef,
  ElRefSpecChild,
  RenderScope,
} from './types';
import {
  isReactive,
  STATUS_ELEMENT,
} from './types';
import type { LatticeContext } from './context';
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
  ctx: LatticeContext;
  withScope: <T>(element: object, fn: (scope: RenderScope) => T) => { result: T; scope: RenderScope };
  trackInSpecificScope: CreateScopes['trackInSpecificScope'];
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  processChildren: (
    parent: ElementRef<TElement>,
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
      spec: ElRefSpec<Tag, TElement>,
      key?: string | number
    ) => RefSpec<TElement>
  >;

/**
 * Create the el primitive factory
 */
export function createElFactory<TElement extends RendererElement, TText extends TextNode = TextNode>(
  opts: ElOpts<TElement, TText>
): ElFactory<TElement> {
  const {
    scopedEffect,
    renderer,
    processChildren,
    withScope,
    trackInSpecificScope
  } = opts;

  // Create helper with captured dependencies
  const applyProps = createApplyProps({ scopedEffect, renderer });

  function el<Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag, TElement>,
    key?: string | number
  ): RefSpec<TElement> {
    const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

    const refSpec: RefSpec<TElement> = (
      lifecycleCallback: LifecycleCallback<TElement>
    ): RefSpec<TElement> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return refSpec;
    };

    // Set the key if provided
    if (key !== undefined) {
      refSpec.key = key;
    }

    const [tag, ...rest] = spec;
    const { props, children } = parseSpec(rest);

    refSpec.create = <TExt>(extensions?: TExt): ElementRef<TElement> & TExt => {
      // Create the element using renderer
      const element = renderer.createElement(tag);
      // Create object with full shape at once (better for V8 hidden classes)
      const elRef: ElementRef<TElement> = {
        status: STATUS_ELEMENT,
        element,
        prev: undefined,
        next: undefined,
        ...extensions, // Spread extensions to override/add fields
      };

      // Create scope and run setup - all orchestration handled by withScope!
      withScope(element, (scope) => {
        applyProps(element, props);
        processChildren(elRef, children);

        // Track lifecycle callbacks
        for (const callback of lifecycleCallbacks) {
          const cleanup = callback(element);
          if (cleanup) trackInSpecificScope(scope, { dispose: cleanup });
        }
      });

      return elRef as ElementRef<TElement> & TExt;
    };

    return refSpec;
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
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
}) {
  const { scopedEffect, renderer } = opts;

  return function applyProps<Tag extends keyof HTMLElementTagNameMap>(
    element: TElement,
    props: ElementProps<Tag>
  ): void {
    for (const [key, val] of Object.entries(props)) {
      // Handle reactive values - cast to unknown first to avoid complex union
      const value = val as unknown;
      if (typeof value === 'function' && ('peek' in value || '__type' in value)) {
        const reactiveValue = value as unknown as () => unknown;
        // Auto-tracked in active scope - no manual trackInScope needed!
        scopedEffect(() => renderer.setAttribute(element, key, reactiveValue()));
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
