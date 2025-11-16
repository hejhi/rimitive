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
    <Tag extends string & keyof TConfig['elements']>(
      tag: Tag,
      props?: ElementProps<TConfig, Tag>
    ): ChildrenApplicator<TConfig, Tag>;
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
  <TConfig extends RendererConfig>({
    scopedEffect,
    renderer,
    createElementScope,
    onCleanup,
  }: ElOpts<TConfig>) =>
    (props: ElProps<TConfig> = {}) => {
      type TBaseElement = TConfig['baseElement'];
      type TElements = TConfig['elements'];
      type TElementKeys = keyof TElements;

      const { instrument } = props;
      const { processChildren } = createProcessChildren<TConfig>({ scopedEffect, renderer });
      const { setAttribute, createElement } = renderer;

      /**
       * Helper to create a RefSpec with lifecycle callback chaining
       * Generic over El - the element type (no longer constrained to HTMLElement)
       */
      const createRefSpec = <El>(
        createElement: (callbacks: LifecycleCallback<El>[], api?: unknown) => ElementRef<El>
      ): RefSpec<El> => {
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
          if (!extensions || Object.keys(extensions).length === 0) return elRef;

          // With extensions, we need to merge - but this breaks FragmentRef mutation
          // For now, prioritize FragmentRef correctness over extensions
          return {
            ...elRef,
            ...extensions,
          };
        };

        return refSpec;
      };

      // Static element builder
      function el<Tag extends string & TElementKeys>(
        tag: Tag,
        props: ElementProps<TConfig, Tag> = {}
      ): ChildrenApplicator<TConfig, Tag> {
        // Return children applicator
        return (...children: ElRefSpecChild[]) => {
          return createRefSpec((lifecycleCallbacks, api) => {
            const element = createElement(tag);
            const elRef: ElementRef<TBaseElement> = {
              status: STATUS_ELEMENT,
              element: element,
              parent: null,
              prev: null,
              next: null,
            };

            createElementScope(element, () => {
              for (const [key, val] of Object.entries(props)) {
                // Event handlers are functions but NOT reactive - treat as static
                const isEventHandler = key.startsWith('on');

                if (typeof val !== 'function' || isEventHandler) {
                  setAttribute(element, key, val);
                  continue;
                }
                // Reactive value - wrap in effect for updates
                scopedEffect(() => setAttribute(element, key, (val as () => unknown)()));
              }
              processChildren(elRef, children, api);

              // Execute lifecycle callbacks within scope
              for (const callback of lifecycleCallbacks) {
                const cleanup = callback(element as TElements[Tag]);
                if (cleanup) onCleanup(cleanup);
              }
            });

            return elRef as ElementRef<TElements[Tag]>;
          });
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
