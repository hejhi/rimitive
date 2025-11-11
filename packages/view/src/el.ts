import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  ElementRef,
  ElRefSpecChild,
  FragmentRef,
} from './types';
import { STATUS_REF_SPEC, STATUS_ELEMENT } from './types';
import type { ViewContext } from './context';
import type { Renderer, RendererConfig } from './renderer';
import type { CreateScopes } from './helpers/scope';
import { createFragment } from './helpers/fragment';
import { createProcessChildren } from './helpers/processChildren';

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
 * Reactive element specification type
 *
 * Generic over:
 * - TConfig: The renderer configuration
 * - Tag: The element tag name
 */
export type ReactiveElSpec<
  TConfig extends RendererConfig,
  Tag extends keyof TConfig['elements']
> = {
  tag: Tag;
  props?: ElementProps<TConfig, Tag>;
  children?: ElRefSpecChild[];
} | null;

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
  ctx: ViewContext<TConfig['baseElement']>;
  createElementScope: CreateScopes['createElementScope'];
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  onCleanup: CreateScopes['onCleanup'];
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

    // Reactive element builder
    <Tag extends keyof TConfig['elements']>(
      reactive: Reactive<ReactiveElSpec<TConfig, Tag>>
    ): FragmentRef<TConfig['baseElement']>;
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
    ctx,
    scopedEffect,
    renderer,
    createElementScope,
    disposeScope,
    onCleanup,
  }: ElOpts<TConfig>) =>
    (props?: ElProps<TConfig>) => {
      type TBaseElement = TConfig['baseElement'];
      type TElements = TConfig['elements'];
      type TElementKeys = keyof TElements;
      type TFragRef = FragmentRef<TBaseElement>;

      const { instrument } = props ?? {};
      const { processChildren } = createProcessChildren<TConfig>({
        scopedEffect,
        renderer,
      });
      const {
        setAttribute,
        createElement,
        insertBefore,
        removeChild
      } = renderer;

      /**
       * Helper to create a RefSpec with lifecycle callback chaining
       * Generic over El - the element type (no longer constrained to HTMLElement)
       */
      const createRefSpec = <El>(
        createElement: (
          callbacks: LifecycleCallback<El>[],
          api?: unknown
        ) => ElementRef<El>
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
          return { ...elRef, ...extensions } as TElRef & TExt;
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

      const createReactiveElement = <Tag extends string & TElementKeys>(
        specReactive: Reactive<ReactiveElSpec<TConfig, Tag>>
      ): TFragRef => {
        const fragRef = createFragment<TBaseElement>((parent, nextSibling) => {
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
            ).create<ElementRef<TBaseElement>>();

            fragRef.firstChild = elementRef;

            // Insert at correct position
            insertBefore(
              parent.element,
              elementRef.element,
              nextSibling?.element ?? null
            );

            // Return cleanup - runs automatically before next effect execution
            return () => {
              const scope = ctx.elementScopes.get(elementRef.element);
              if (scope) disposeScope(scope);
              removeChild(parent.element, elementRef.element);
            };
          });
        });

        return fragRef;
      };

      // Overloaded implementation
      function el<Tag extends string & TElementKeys>(
        tag: Tag,
        props?: ElementProps<TConfig, Tag>
      ): ChildrenApplicator<TConfig, Tag>;
      function el<Tag extends string & TElementKeys>(
        reactive: Reactive<ReactiveElSpec<TConfig, Tag>>
      ): TFragRef;
      function el<Tag extends string & TElementKeys>(
        tagOrReactive: Tag | Reactive<ReactiveElSpec<TConfig, Tag>>,
        props?: ElementProps<TConfig, Tag>
      ): ChildrenApplicator<TConfig, Tag> | TFragRef {
        // Handle reactive case
        if (typeof tagOrReactive === 'function') {
          return createReactiveElement(tagOrReactive);
        }

        // Return children applicator which returns RefSpec directly
        return (...children: ElRefSpecChild[]) => {
          return createStaticElement(
            tagOrReactive,
            props ?? {},
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
