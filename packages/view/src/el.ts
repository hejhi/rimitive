import type { LatticeExtension } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  ElementRef,
  ElRefSpecChild,
  FragmentRef,
} from './types';
import {
  isReactive,
  STATUS_ELEMENT,
  STATUS_FRAGMENT,
} from './types';
import type { LatticeContext } from './context';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import type { CreateScopes } from './helpers/scope';
import { createFragment } from './helpers/fragment';

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
    status?: never; // Discriminant to prevent overlap with FragmentRef/ElementRef
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
  ctx: LatticeContext<TElement>;
  createElementScope: CreateScopes['createElementScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  onCleanup: CreateScopes['onCleanup'];
  renderer: Renderer<TElement, TText>;
  processChildren: (
    parent: ElementRef<TElement>,
    children: ElRefSpecChild<TElement>[]
  ) => void;
};

/**
 * Factory return type - supports both static and reactive specs
 * el(['button']) → RefSpec<HTMLButtonElement>
 * el(computed(() => ['button'])) → FragmentRef<TElement>
 */
export type ElFactory<TElement extends RendererElement> = LatticeExtension<
  'el',
  {
    // Static spec overload
    <Tag extends keyof HTMLElementTagNameMap>(
      spec: ElRefSpec<Tag, TElement>
    ): RefSpec<HTMLElementTagNameMap[Tag]>;
    // Reactive spec overload
    <Tag extends keyof HTMLElementTagNameMap>(
      spec: Reactive<ElRefSpec<Tag, TElement> | null>
    ): FragmentRef<TElement>;
  }
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
    createElementScope,
    onCleanup,
  } = opts;

  // Create helpers with captured dependencies
  const applyProps = createApplyProps({ scopedEffect, renderer });

  // Function overloads for proper type inference
  function el<Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag, TElement>
  ): RefSpec<HTMLElementTagNameMap[Tag]>;
  function el<Tag extends keyof HTMLElementTagNameMap>(
    spec: Reactive<ElRefSpec<Tag, TElement> | null>
  ): FragmentRef<TElement>;
  function el<Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag, TElement> | Reactive<ElRefSpec<Tag, TElement> | null>
  ): RefSpec<HTMLElementTagNameMap[Tag]> | FragmentRef<TElement> {
    // Check if spec itself is reactive
    if (isReactive(spec)) {
      return createReactiveElement(spec);
    }

    // Static spec path - existing logic
    return createStaticElement(spec);
  }

  function createStaticElement<Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag, TElement>
  ): RefSpec<HTMLElementTagNameMap[Tag]> {
    type El = HTMLElementTagNameMap[Tag];
    const lifecycleCallbacks: LifecycleCallback<El>[] = [];

    const refSpec: RefSpec<El> = (
      lifecycleCallback: LifecycleCallback<El>
    ): RefSpec<El> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return refSpec;
    };

    const [tag, ...rest] = spec;
    const { props, children } = parseSpec(rest);

    refSpec.create = <TExt>(extensions?: TExt): ElementRef<El> & TExt => {
      const element = renderer.createElement(tag) as unknown as El;
      const elRef: ElementRef<El> = {
        status: STATUS_ELEMENT,
        element,
        next: undefined,
        ...extensions,
      };

      createElementScope(element, () => {
        applyProps(element as unknown as TElement, props);
        processChildren(elRef as unknown as ElementRef<TElement>, children);

        for (const callback of lifecycleCallbacks) {
          const cleanup = callback(element);
          if (cleanup) onCleanup(cleanup);
        }
      });

      return elRef as ElementRef<El> & TExt;
    };

    return refSpec;
  }

  function createReactiveElement<Tag extends keyof HTMLElementTagNameMap>(
    specReactive: Reactive<ElRefSpec<Tag, TElement> | null>
  ): FragmentRef<TElement> {
    const fragRef = createFragment<TElement>((parent, nextSibling) => {
      let currentElementRef: ElementRef<TElement> | undefined;

      const dispose = scopedEffect(() => {
        const newSpec = specReactive();

        // Clean up old element if it exists
        if (currentElementRef) {
          const scope = opts.ctx.elementScopes.get(currentElementRef.element);
          if (scope) {
            opts.ctx.elementScopes.delete(currentElementRef.element);
            // Dispose scope will clean up all effects/subscriptions
            scope.cleanup?.();
          }
          renderer.removeChild(parent.element, currentElementRef.element);
          currentElementRef = undefined;
        }

        if (newSpec === null) {
          // Empty fragment - no DOM nodes
          fragRef.firstChild = undefined;
        } else {
          // Create new element from spec
          const refSpec = createStaticElement(newSpec);
          currentElementRef = refSpec.create() as unknown as ElementRef<TElement>;
          fragRef.firstChild = currentElementRef;

          // Insert at correct position
          const nextEl = nextSibling?.element ?? null;
          renderer.insertBefore(parent.element, currentElementRef.element, nextEl);
        }
      });

      return dispose;
    });

    return fragRef;
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
