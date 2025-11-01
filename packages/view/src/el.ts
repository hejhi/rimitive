import type { LatticeExtension } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  ElementRef,
  ElRefSpecChild,
  FragmentRef,
} from './types';
import { STATUS_REF_SPEC, STATUS_ELEMENT, STATUS_FRAGMENT } from './types';
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
  disposeScope: CreateScopes['disposeScope'];
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
export function createElFactory<
  TElement extends RendererElement,
  TText extends TextNode = TextNode,
>({
  ctx,
  scopedEffect,
  renderer,
  processChildren,
  createElementScope,
  disposeScope,
  onCleanup,
}: ElOpts<TElement, TText>): ElFactory<TElement> {
  // Create helpers with captured dependencies
  const applyProps = createApplyProps({ scopedEffect, renderer });

  const createStaticElement = <Tag extends keyof HTMLElementTagNameMap>(
    spec: ElRefSpec<Tag, TElement>
  ): RefSpec<HTMLElementTagNameMap[Tag]> => {
    type El = HTMLElementTagNameMap[Tag];
    const lifecycleCallbacks: LifecycleCallback<El>[] = [];

    const refSpec: RefSpec<El> = (
      lifecycleCallback: LifecycleCallback<El>
    ): RefSpec<El> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return refSpec;
    };

    refSpec.status = STATUS_REF_SPEC;

    const [tag, ...rest] = spec;
    const { props, children } = parseSpec(rest);

    refSpec.create = <TExt>(extensions?: TExt): ElementRef<El> & TExt => {
      const element = renderer.createElement(tag) as unknown as El;
      const elRef: ElementRef<El> & TExt = {
        status: STATUS_ELEMENT,
        element,
        next: undefined,
        ...(extensions as TExt),
      };

      createElementScope(element, () => {
        applyProps(element as unknown as TElement, props);
        processChildren(elRef as unknown as ElementRef<TElement>, children);

        for (const callback of lifecycleCallbacks) {
          const cleanup = callback(element);
          if (cleanup) onCleanup(cleanup);
        }
      });

      return elRef;
    };

    return refSpec;
  };

  const createReactiveElement = <Tag extends keyof HTMLElementTagNameMap>(
    specReactive: Reactive<ElRefSpec<Tag, TElement> | null>
  ): FragmentRef<TElement> => {
    return createFragment((parent, nextSibling, fragRef) => {
      return scopedEffect(() => {
        const newSpec = specReactive();

        // Empty fragment - no DOM nodes
        if (newSpec === null) {
          fragRef.firstChild = undefined;
          return; // No cleanup needed
        }

        // Create new element from spec
        const elementRef = createStaticElement(newSpec)
          .create<ElementRef<TElement>>();

        fragRef.firstChild = elementRef;

        // Insert at correct position
        renderer.insertBefore(
          parent.element,
          elementRef.element,
          nextSibling?.element ?? null
        );

        // Return cleanup - runs automatically before next effect execution
        return () => {
          const scope = ctx.elementScopes.get(elementRef.element);
          if (scope) disposeScope(scope);
          renderer.removeChild(parent.element, elementRef.element);
        };
      });
    });
  };

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
    if (typeof spec === 'function') return createReactiveElement(spec);
    return createStaticElement(spec);
  }

  return { name: 'el', method: el };
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
  const props = {};
  const children: ElRefSpecChild<TElement>[] = [];
  let childIndex = 0;

  for (const item of rest) {
    if (item == undefined || typeof item === 'boolean') continue;

    if (
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'function' ||
      ('status' in item && item.status === STATUS_FRAGMENT)
    ) {
      children[childIndex++] = item;
      continue;
    }

    Object.assign(props, item);
  }

  return { props, children };
}

/**
 * Apply props to element (with reactivity)
 */
function createApplyProps<
  TElement extends RendererElement,
  TText extends TextNode
>({ scopedEffect, renderer }: {
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
}) {
  return <Tag extends keyof HTMLElementTagNameMap>(
    element: TElement,
    props: ElementProps<Tag>
  ): void => {
    for (const [key, val] of Object.entries(props)) {
      // Handle reactive values - cast to unknown first to avoid complex union
      if (typeof val !== 'function') {
        renderer.setAttribute(element, key, val);
        continue;
      }

      // Auto-tracked in active scope
      scopedEffect(() => renderer.setAttribute(
        element,
        key,
        (val as () => unknown)()
      ));
    }
  };
}
