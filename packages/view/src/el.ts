import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  ElementRef,
  ElRefSpecChild,
} from './types';
import { STATUS_REF_SPEC, STATUS_ELEMENT } from './types';
import type { Renderer, RendererConfig } from './renderer';
import type { CreateScopes } from './helpers/scope';
import { createFragmentHelpers } from './helpers/fragment';
import { createProcessChildren } from './helpers/processChildren';

const { createFragment } = createFragmentHelpers();

/**
 * Makes each property in T accept either the value or a Reactive<value>
 */
type ReactiveProps<T> = {
  [K in keyof T]?: T[K] | Reactive<T[K]>;
};

/**
 * Props for an element - type-safe based on the renderer's element configuration
 * Each prop can be either a static value or a Reactive value
 *
 * Generic over:
 * - TConfig: The renderer configuration
 * - Tag: The element tag name (must be a key in TConfig['elements'])
 */
export type ElementProps<
  TConfig extends RendererConfig,
  Tag extends keyof TConfig['elements']
> = ReactiveProps<TConfig['elements'][Tag]> & {
  status?: never; // Discriminant to prevent overlap with FragmentRef/ElementRef
};


/**
 * Options passed to el factory
 *
 * Generic over:
 * - TConfig: The renderer configuration
 * - TElement: Base element type
 * - TText: Text node type
 */
export type ElOpts<
  TConfig extends RendererConfig,
> = {
  createElementScope: CreateScopes['createElementScope'];
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  onCleanup: CreateScopes['onCleanup'];
  getElementScope: CreateScopes['getElementScope'];
  renderer: Renderer<TConfig>;
};

export type ElProps<TConfig extends RendererConfig> = {
  instrument?: (
    method: ElFactory<TConfig>['method'],
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => ElFactory<TConfig>['method'];
};

/**
 * Children applicator - returned from el(tag, props)
 * Returns RefSpec which is itself callable for chaining lifecycle callbacks
 *
 * Generic over:
 * - TConfig: The renderer configuration
 * - Tag: The element tag name
 */
export type ChildrenApplicator<
  TConfig extends RendererConfig,
  Tag extends keyof TConfig['elements']
> = (
  ...children: ElRefSpecChild[]
) => RefSpec<TConfig['elements'][Tag]>;

/**
 * Factory return type - curried element builder
 *
 * Element construction is separated into two phases:
 * 1. Structure phase: el(tag, props)(children) - Pure, returns RefSpec blueprint
 * 2. Behavior phase: refSpec(lifecycle) - Imperative, attaches side effects
 *
 * Supports both static and reactive tags:
 * - Static: el('div', props)(children)(lifecycle)
 * - Reactive: el(computed(() => 'div'), props)(children)(lifecycle)
 * - Conditional: el(computed(() => show ? 'div' : null), props)(children)
 *
 * Generic over:
 * - TConfig: The renderer configuration
 */
export type ElFactory<
  TConfig extends RendererConfig
> = LatticeExtension<
  'el',
  {
    // Static element builder
    <Tag extends keyof TConfig['elements']>(
      tag: Tag,
      props?: ElementProps<TConfig, Tag>
    ): ChildrenApplicator<TConfig, Tag>;

    // Reactive tag builder - tag can be dynamic or null for conditional rendering
    // The element type is the union of all possible tag element types
    <Tag extends keyof TConfig['elements']>(
      reactive: Reactive<Tag | null>,
      props?: Record<string, unknown>
    ): (...children: ElRefSpecChild[]) => RefSpec<TConfig['elements'][Tag]>;
  }
>;

/**
 * El primitive - instantiatable extension using the create pattern
 * Similar to Signal() in signals preset
 *
 * Generic over:
 * - TConfig: The renderer configuration (inferred from renderer)
 * - TElement: Base element type
 * - TText: Text node type
 */
export const El = create(
  <
    TConfig extends RendererConfig,
  >({
    scopedEffect,
    renderer,
    createElementScope,
    disposeScope,
    onCleanup,
    getElementScope,
  }: ElOpts<TConfig>) =>
    (props?: ElProps<TConfig>) => {
      type TBaseElement = TConfig['baseElement'];
      type TElements = TConfig['elements'];
      type TElementKeys = keyof TElements;

      const { instrument } = props ?? {};
      const { processChildren } = createProcessChildren<TConfig>({ scopedEffect, renderer });
      const { setAttribute, createElement, insertBefore, removeChild } = renderer;

      /**
       * Helper to create a RefSpec with lifecycle callback chaining
       * Generic over El - the element type (no longer constrained to HTMLElement)
       */
      const createRefSpec = <El>(
        createElement: (callbacks: LifecycleCallback<El>[], api?: unknown) => ElementRef<El>
      ): RefSpec<El> => {
        type TElRef = ElementRef<El>;
        const lifecycleCallbacks: LifecycleCallback<El>[] = [];

        const refSpec: RefSpec<El> = (
          ...callbacks: LifecycleCallback<El>[]
        ) => {
          lifecycleCallbacks.push(...callbacks);
          return refSpec;
        };

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(
          api?: unknown,
          extensions?: TExt
        ) => {
          const elRef = createElement(lifecycleCallbacks, api);
          // If no extensions, return the ref directly to preserve mutability
          // This is critical for FragmentRef which gets firstChild set after creation
          if (!extensions || Object.keys(extensions).length === 0) {
            return elRef as TElRef & TExt;
          }
          // With extensions, we need to merge - but this breaks FragmentRef mutation
          // For now, prioritize FragmentRef correctness over extensions
          return {
            ...elRef,
            ...extensions
          } as TElRef & TExt;
        };

        return refSpec;
      };

      const createAttrEffect =
        <TEl extends TBaseElement>(
          element: TEl,
          key: string,
          getter: () => unknown
        ) => () => setAttribute(element, key, getter());

      const createStaticElement = <Tag extends string & TElementKeys>(
        tag: Tag,
        props: ElementProps<TConfig, Tag>,
        children: ElRefSpecChild[]
      ): RefSpec<TElements[Tag]> => {
        // The specific element the user provides
        type TElement = TElements[Tag];

        return createRefSpec<TElement>((lifecycleCallbacks, api) => {
          const element = createElement(tag);
          const elRef: ElementRef<TBaseElement> = {
            status: STATUS_ELEMENT,
            element: element,
            next: undefined,
          };

          createElementScope(element, () => {
            for (const [key, val] of Object.entries(props)) {
              if (typeof val !== 'function') {
                setAttribute(element, key, val);
                continue;
              }
              scopedEffect(
                createAttrEffect(element, key, val as () => unknown)
              );
            }
            processChildren(elRef, children, api);

            // Execute lifecycle callbacks within scope
            for (const callback of lifecycleCallbacks) {
              const cleanup = callback(element as TElement);
              if (cleanup) onCleanup(cleanup);
            }
          });

          return elRef as ElementRef<TElement>;
        });
      };

      /**
       * Creates a reactive element that can swap between different tags
       * Returns a ChildrenApplicator to maintain the curried API
       */
      const createReactiveElement = <Tag extends string & TElementKeys>(
        tagReactive: Reactive<Tag | null>,
        props: Record<string, unknown>,
        children: ElRefSpecChild[]
      ): RefSpec<TElements[Tag]> => {
        return createRefSpec<TElements[Tag]>((lifecycleCallbacks, api) => {
          const fragRef = createFragment<TBaseElement>((parent, nextSibling) => {
            return scopedEffect(() => {
              const tag = tagReactive();

              // Conditional rendering - null means no element
              if (tag === null) {
                fragRef.firstChild = undefined;
                return; // No cleanup needed
              }

              // Create static element with accumulated props/children
              // Type assertion needed because props is Record<string, unknown> for reactive tags
              // but createStaticElement expects ElementProps<TConfig, Tag>
              let refSpec = createStaticElement(tag, props as ElementProps<TConfig, Tag>, children);

              // Apply accumulated lifecycle callbacks
              // Lifecycle callbacks use TBaseElement (the common base type) which is safe to use
              // with any specific element type Tag since all elements extend from the base
              for (const callback of lifecycleCallbacks) {
                refSpec = refSpec(callback as LifecycleCallback<TElements[Tag]>);
              }

              const nodeRef = refSpec.create(api);

              // createStaticElement always returns ElementRef, not FragmentRef
              const elementRef = nodeRef as ElementRef<TBaseElement>;

              fragRef.firstChild = elementRef;

              // Insert at correct position
              insertBefore(
                parent.element,
                elementRef.element,
                nextSibling?.element ?? null
              );

              // Return cleanup - runs automatically before next effect execution
              return () => {
                const scope = getElementScope(elementRef.element);
                if (scope) disposeScope(scope);
                removeChild(parent.element, elementRef.element);
              };
            });
          });

          // FragmentRef is structurally compatible with ElementRef
          // Cast to the union type so lifecycle callbacks get proper element types
          return fragRef as unknown as ElementRef<TElements[Tag]>;
        });
      };

      // Overloaded implementation
      function el<Tag extends string & TElementKeys>(
        tag: Tag,
        props?: ElementProps<TConfig, Tag>
      ): ChildrenApplicator<TConfig, Tag>;
      function el<Tag extends string & TElementKeys>(
        reactive: Reactive<Tag | null>,
        props?: Record<string, unknown>
      ): (...children: ElRefSpecChild[]) => RefSpec<TElements[Tag]>;
      function el<Tag extends string & TElementKeys>(
        tagOrReactive: Tag | Reactive<Tag | null>,
        props?: ElementProps<TConfig, Tag> | Record<string, unknown>
      ): ChildrenApplicator<TConfig, Tag> | ((...children: ElRefSpecChild[]) => RefSpec<TElements[Tag]>) {
        // Handle reactive tag case
        if (typeof tagOrReactive === 'function') {
          return (...children: ElRefSpecChild[]) => {
            return createReactiveElement(
              tagOrReactive,
              props ?? {},
              children
            );
          };
        }

        // Handle static tag case - return children applicator
        return (...children: ElRefSpecChild[]) => {
          return createStaticElement(
            tagOrReactive,
            (props ?? {}) as ElementProps<TConfig, Tag>,
            children
          );
        };
      }

      const extension: ElFactory<TConfig> = {
        name: 'el',
        method: el,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
