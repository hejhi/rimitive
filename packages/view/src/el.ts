import type { LatticeExtension } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  ElementRef,
  ElRefSpecChild,
  FragmentRef,
} from './types';
import { STATUS_REF_SPEC, STATUS_ELEMENT } from './types';
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
 * Reactive element specification type
 */
export type ReactiveElSpec<Tag extends keyof HTMLElementTagNameMap> = {
  tag: Tag;
  props?: ElementProps<Tag>;
  children?: ElRefSpecChild[];
} | null;

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
    children: ElRefSpecChild[],
    api?: unknown
  ) => void;
};

/**
 * Children applicator - returned from el(tag, props)
 * Returns RefSpec which is itself callable for chaining lifecycle callbacks
 */
export type ChildrenApplicator<Tag extends keyof HTMLElementTagNameMap> = (
  ...children: ElRefSpecChild[]
) => RefSpec<HTMLElementTagNameMap[Tag]>;

/**
 * Factory return type - curried element builder
 *
 * Element construction is separated into two phases:
 * 1. Structure phase: el(tag, props)(children) - Pure, returns RefSpec blueprint
 * 2. Behavior phase: refSpec(lifecycle) - Imperative, attaches side effects
 */
export type ElFactory<TElement extends RendererElement> = LatticeExtension<
  'el',
  {
    // Static element builder
    <Tag extends keyof HTMLElementTagNameMap>(
      tag: Tag,
      props?: ElementProps<Tag>
    ): ChildrenApplicator<Tag>;

    // Reactive element builder
    <Tag extends keyof HTMLElementTagNameMap>(
      reactive: Reactive<ReactiveElSpec<Tag>>
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
  /**
   * Helper to create a RefSpec with lifecycle callback chaining
   */
  const createRefSpec = <El extends HTMLElement>(
    createElement: (callbacks: LifecycleCallback<El>[], api?: unknown) => ElementRef<El>
  ): RefSpec<El> => {
    const lifecycleCallbacks: LifecycleCallback<El>[] = [];

    const refSpec: RefSpec<El> = (...callbacks: LifecycleCallback<El>[]) => {
      lifecycleCallbacks.push(...callbacks);
      return refSpec;
    };

    refSpec.status = STATUS_REF_SPEC;

    refSpec.create = <TExt>(api?: unknown, extensions?: TExt): ElementRef<El> & TExt => {
      const elRef = createElement(lifecycleCallbacks, api);
      return { ...elRef, ...extensions } as ElementRef<El> & TExt;
    };

    return refSpec;
  };

  const createAttrEffect = <TEl extends TElement>(
    element: TEl,
    key: string,
    getter: () => unknown
  ) => () => renderer.setAttribute(element, key, getter());

  const createStaticElement = <Tag extends keyof HTMLElementTagNameMap>(
    tag: Tag,
    props: ElementProps<Tag>,
    children: ElRefSpecChild[]
  ): RefSpec<HTMLElementTagNameMap[Tag]> => {
    type El = HTMLElementTagNameMap[Tag];

    return createRefSpec<El>((lifecycleCallbacks, api) => {
      const element = renderer.createElement(tag) as unknown as El;
      const elRef: ElementRef<El> = {
        status: STATUS_ELEMENT,
        element,
        next: undefined,
      };

      createElementScope(element, () => {
        for (const [key, val] of Object.entries(props)) {
          if (typeof val !== 'function') {
            renderer.setAttribute(element as unknown as TElement, key, val);
            continue;
          }
          scopedEffect(
            createAttrEffect(
              element as unknown as TElement,
              key,
              val as () => unknown
            )
          );
        }
        processChildren(elRef as unknown as ElementRef<TElement>, children, api);

        // Execute lifecycle callbacks within scope
        for (const callback of lifecycleCallbacks) {
          const cleanup = callback(element);
          if (cleanup) onCleanup(cleanup);
        }
      });

      return elRef;
    });
  };

  const createReactiveElement = <Tag extends keyof HTMLElementTagNameMap>(
    specReactive: Reactive<ReactiveElSpec<Tag>>
  ): FragmentRef<TElement> => {
    return createFragment((parent, nextSibling, fragRef) => {
      return scopedEffect(() => {
        const spec = specReactive();

        // Empty fragment - no DOM nodes
        if (spec === null) {
          fragRef.firstChild = undefined;
          return; // No cleanup needed
        }

        // Create new element from spec
        const elementRef = createStaticElement(
          spec.tag,
          spec.props || {},
          spec.children || []
        ).create<ElementRef<TElement>>();

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

  // Overloaded implementation
  function el<Tag extends keyof HTMLElementTagNameMap>(
    tag: Tag,
    props?: ElementProps<Tag>
  ): ChildrenApplicator<Tag>;
  function el<Tag extends keyof HTMLElementTagNameMap>(
    reactive: Reactive<ReactiveElSpec<Tag>>
  ): FragmentRef<TElement>;
  function el<Tag extends keyof HTMLElementTagNameMap>(
    tagOrReactive: Tag | Reactive<ReactiveElSpec<Tag>>,
    props?: ElementProps<Tag>
  ): ChildrenApplicator<Tag> | FragmentRef<TElement> {
    // Handle reactive case
    if (typeof tagOrReactive === 'function') {
      return createReactiveElement(tagOrReactive);
    }

    // Return children applicator which returns RefSpec directly
    return (...children: ElRefSpecChild[]) => {
      return createStaticElement(
        tagOrReactive,
        props ?? ({} as ElementProps<Tag>),
        children
      );
    };
  }

  return { name: 'el', method: el };
}
