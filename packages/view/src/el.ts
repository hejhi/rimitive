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
  STATUS_FRAGMENT,
} from './types';
import type { LatticeContext } from './context';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { createOnCleanup } from './helpers/on-cleanup';

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
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  processChildren: (
    parent: ElementRef<TElement>,
    children: ElRefSpecChild<TElement>[]
  ) => void;
};

/**
 * Helper type to resolve the specific element type based on tag
 * When TElement is exactly `object` or `HTMLElement` (DOM renderer), resolves to specific HTML element type
 * For other renderers (MockElement, linkedom, etc.), returns TElement
 *
 * Uses double-extends trick to check if TElement is EXACTLY object or HTMLElement,
 * not a subtype with additional properties
 */
type ResolveElementType<TElement, Tag extends keyof HTMLElementTagNameMap> =
  [TElement] extends [object]
    ? [object] extends [TElement]
      ? HTMLElementTagNameMap[Tag]
      : [TElement] extends [HTMLElement]
        ? [HTMLElement] extends [TElement]
          ? HTMLElementTagNameMap[Tag]
          : TElement
        : TElement
    : TElement;

/**
 * Factory return type
 * Generic over element type
 *
 * IMPORTANT: When using with object/HTMLElement (DOM renderer), this returns specific HTML element types.
 * Example: el(['button', ...]) returns RefSpec<HTMLButtonElement>
 *         el(['a', ...]) returns RefSpec<HTMLAnchorElement>
 *
 * For other renderers (linkedom, etc.), it returns RefSpec<TElement>
 */
export type ElFactory<TElement extends RendererElement = RendererElement> =
  LatticeExtension<
    'el',
    <Tag extends keyof HTMLElementTagNameMap>(
      spec: ElRefSpec<Tag, TElement>,
      key?: string | number
    ) => RefSpec<ResolveElementType<TElement, Tag>>
  >;

/**
 * Create the el primitive factory
 */
export function createElFactory<TElement extends RendererElement, TText extends TextNode = TextNode>(
  opts: ElOpts<TElement, TText>
): ElFactory<TElement> {
  const {
    ctx,
    scopedEffect,
    renderer,
    processChildren,
    withScope,
  } = opts;

  // Create helpers with captured dependencies
  const applyProps = createApplyProps({ scopedEffect, renderer });
  const onCleanup = createOnCleanup(ctx);

  function el<Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag, TElement>,
    key?: string | number
  ): RefSpec<ResolveElementType<TElement, Tag>> {
    type SpecificElement = ResolveElementType<TElement, Tag>;
    const lifecycleCallbacks: LifecycleCallback<SpecificElement>[] = [];

    const refSpec: RefSpec<SpecificElement> = (
      lifecycleCallback: LifecycleCallback<SpecificElement>
    ): RefSpec<SpecificElement> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return refSpec;
    };

    // Set the key if provided
    if (key !== undefined) refSpec.key = key;

    const [tag, ...rest] = spec;
    const { props, children } = parseSpec(rest);

    refSpec.create = <TExt>(extensions?: TExt): ElementRef<SpecificElement> & TExt => {
      // Create the element using renderer
      const element = renderer.createElement(tag) as SpecificElement;
      // Create object with full shape at once (better for V8 hidden classes)
      const elRef: ElementRef<SpecificElement> = {
        status: STATUS_ELEMENT,
        element,
        prev: undefined,
        next: undefined,
        ...extensions, // Spread extensions to override/add fields
      };

      // Create scope and run setup - all orchestration handled by withScope!
      withScope(element as unknown as TElement, () => {
        applyProps(element as unknown as TElement, props);
        processChildren(elRef as unknown as ElementRef<TElement>, children);

        // Track lifecycle callbacks
        for (const callback of lifecycleCallbacks) {
          const cleanup = callback(element);
          if (cleanup) onCleanup(cleanup);
        }
      });

      return elRef as ElementRef<SpecificElement> & TExt;
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
    // Check if it's a FragmentRef (has status: STATUS_FRAGMENT)
    if (isPlainObject(item) && 'status' in item && item.status === STATUS_FRAGMENT) {
      children.push(item as ElRefSpecChild<TElement>);
    }
    // It's props (plain object that's not reactive and not a ref)
    else if (isPlainObject(item) && !isReactive(item)) {
      Object.assign(props, item);
    }
    // It's a child (string, number, RefSpec, Reactive)
    else {
      children.push(item);
    }
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
        // Auto-tracked in active scope
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
