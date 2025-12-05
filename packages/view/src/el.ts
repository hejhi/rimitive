import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  ElementRef,
  ElRefSpecChild,
  ParentContext,
} from './types';
import { STATUS_REF_SPEC, STATUS_ELEMENT } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './helpers/scope';
import { createProcessChildren } from './helpers/processChildren';

/**
 * Makes each property in T accept either the value or a Reactive<value>
 *
 * @example
 * ```typescript
 * import type { ReactiveProps } from '@lattice/view/el';
 *
 * type ButtonProps = ReactiveProps<{ disabled: boolean; textContent: string }>;
 * const props: ButtonProps = {
 *   disabled: computed(() => count() > 10),
 *   textContent: 'Click me'
 * };
 * ```
 */
type ReactiveProps<T> = {
  [K in keyof T]?: T[K] | Reactive<T[K]>;
};

/**
 * Props for an element - type-safe based on the renderer's props configuration
 * Each prop can be either a static value or a Reactive value
 *
 * The type provides autocomplete for known element properties while allowing
 * arbitrary attributes (data-*, aria-*, custom attributes) via index signature.
 * This matches real DOM behavior where any attribute can be set on any element.
 *
 * Generic over:
 * - TConfig: The renderer configuration
 * - Tag: The element tag name (must be a key in TConfig['props'])
 *
 * @example
 * ```typescript
 * import type { ElementProps } from '@lattice/view/el';
 * import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
 *
 * const buttonProps: ElementProps<DOMAdapterConfig, 'button'> = {
 *   disabled: computed(() => loading()),
 *   textContent: 'Submit',
 *   'data-testid': 'submit-btn'
 * };
 * ```
 */
export type ElementProps<
  TConfig extends AdapterConfig,
  Tag extends keyof TConfig['props'],
> = ReactiveProps<TConfig['props'][Tag]> & {
  status?: never; // Discriminant to prevent overlap with FragmentRef/ElementRef
  [key: string]: unknown; // Allow arbitrary attributes (data-*, aria-*, custom)
};

/**
 * Options passed to el factory
 *
 * Generic over:
 * - TConfig: The renderer configuration
 * - TElement: Base element type
 * - TText: Text node type
 */
export type ElOpts<TConfig extends AdapterConfig> = {
  createElementScope: CreateScopes['createElementScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  onCleanup: CreateScopes['onCleanup'];
  adapter: Adapter<TConfig>;
};

export type ElProps<TConfig extends AdapterConfig> = {
  instrument?: (
    impl: ElFactory<TConfig>['impl'],
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => ElFactory<TConfig>['impl'];
};

/**
 * Tag factory - returned from el(tag)
 * Callable with children to create RefSpec, or use .props()/.ref() to configure
 *
 * Generic over:
 * - TConfig: The renderer configuration
 * - Tag: The element tag name (must exist in both props and elements)
 *
 * @example
 * ```typescript
 * import { createDOMSvc } from '@lattice/view/presets/dom';
 *
 * const { el, signal, on } = createDOMSvc();
 * const count = signal(0);
 *
 * // Basic usage - just children
 * const title = el('h1')('My App');
 *
 * // With props
 * const button = el('button')
 *   .props({ disabled: false })
 *   ('Click me');
 *
 * // With ref callbacks
 * const input = el('input')
 *   .ref((elem) => elem.focus())
 *   .ref(on('input', (e) => console.log(e.target.value)))
 *   ();
 * ```
 */
export type TagFactory<
  TConfig extends AdapterConfig,
  Tag extends keyof TConfig['props'] & keyof TConfig['elements'],
> = {
  /**
   * Apply children to create a RefSpec
   */
  (...children: ElRefSpecChild[]): RefSpec<TConfig['elements'][Tag]>;

  /**
   * Add properties to the element, returning a new TagFactory
   * Can be called with props object or a function that receives current props
   */
  props(
    propsOrFn:
      | ElementProps<TConfig, Tag>
      | ((current: ElementProps<TConfig, Tag>) => ElementProps<TConfig, Tag>)
  ): TagFactory<TConfig, Tag>;

  /**
   * Add lifecycle callback(s), returning a new TagFactory
   * Callbacks receive the element when created and can return cleanup functions
   */
  ref(
    ...callbacks: LifecycleCallback<TConfig['elements'][Tag]>[]
  ): TagFactory<TConfig, Tag>;
};

/**
 * Factory return type - element builder
 *
 * Element construction is separated into phases:
 * 1. Tag phase: el(tag) - Returns TagFactory
 * 2. Props phase (optional): factory.props({}) - Returns new TagFactory with props
 * 3. Ref phase (optional): factory.ref(callback) - Returns new TagFactory with lifecycle
 * 4. Children phase: factory(children) - Returns RefSpec blueprint
 *
 * Generic over:
 * - TConfig: The renderer configuration
 *
 * @example
 * ```typescript
 * import { createDOMSvc } from '@lattice/view/presets/dom';
 *
 * const { el, signal, computed, on } = createDOMSvc();
 * const count = signal(0);
 *
 * const counter = el('div').props({ className: 'counter' })(
 *   el('h2')('Counter'),
 *   el('p')(computed(() => `Count: ${count()}`)),
 *   el('button').ref(on('click', () => count(c => c + 1)))('Increment'),
 *   el('button').ref(on('click', () => count(c => c - 1)))('Decrement')
 * );
 * ```
 */
/**
 * ServiceDefinition for the el primitive.
 * This is what gets composed into a service context.
 */
export type ElFactory<TConfig extends AdapterConfig> = ServiceDefinition<
  'el',
  {
    // Tag selector - returns a TagFactory
    <Tag extends string & keyof TConfig['props'] & keyof TConfig['elements']>(
      tag: Tag
    ): TagFactory<TConfig, Tag>;
  }
>;

/**
 * The instantiable service returned by El().
 *
 * Use this type when building custom view service compositions:
 * @example
 * ```ts
 * import { El, type ElService } from '@lattice/view/el';
 *
 * const elService: ElService<DOMAdapterConfig> = El<DOMAdapterConfig>();
 * const factory = elService.create(opts); // ElFactory<DOMAdapterConfig>
 * ```
 */
export type ElService<TConfig extends AdapterConfig> = ReturnType<
  typeof El<TConfig>
>;

/**
 * El primitive - instantiatable extension using the create pattern
 * Similar to Signal() in signals preset
 *
 * Generic over:
 * - TConfig: The renderer configuration (inferred from renderer)
 * - TElement: Base element type
 * - TText: Text node type
 *
 * @example
 * ```typescript
 * import { El } from '@lattice/view/el';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
 *
 * const elService = El<DOMAdapterConfig>();
 * const elFactory = elService.create({ adapter, scopedEffect, createElementScope, onCleanup });
 *
 * const button = elFactory('button')
 *   .props({ textContent: 'Click me' })
 *   ();
 * ```
 */
export const El = defineService(
  <TConfig extends AdapterConfig>({
    scopedEffect,
    adapter,
    createElementScope,
    onCleanup,
  }: ElOpts<TConfig>) =>
    (props: ElProps<TConfig> = {}) => {
      type TBaseElement = TConfig['baseElement'];
      type TProps = TConfig['props'];
      type TElements = TConfig['elements'];
      type TElementKeys = keyof TProps & keyof TElements;

      const { instrument } = props;
      const { processChildren } = createProcessChildren<TConfig>({
        scopedEffect,
        adapter,
      });
      const { setProperty, createNode } = adapter;

      /**
       * Helper to create a RefSpec
       * Generic over El - the element type (no longer constrained to HTMLElement)
       */
      const createRefSpec = <El>(
        createElement: (
          svc?: unknown,
          parentContext?: ParentContext<unknown>
        ) => ElementRef<El>
      ): RefSpec<El> => {
        const refSpec = {} as RefSpec<El>;

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(
          svc?: unknown,
          extensions?: TExt,
          parentContext?: ParentContext<unknown>
        ) => {
          const elRef = createElement(svc, parentContext);
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

      /**
       * Create a TagFactory for a given tag with accumulated props and lifecycle callbacks
       */
      function createTagFactory<Tag extends string & TElementKeys>(
        tag: Tag,
        accumulatedProps: ElementProps<TConfig, Tag>,
        accumulatedCallbacks: LifecycleCallback<TElements[Tag]>[]
      ): TagFactory<TConfig, Tag> {
        // The callable part - applies children and returns RefSpec
        const factory = (...children: ElRefSpecChild[]) => {
          return createRefSpec((svc, parentContext) => {
            // Pass initial props to createNode - needed for renderers that require
            // props at creation time (e.g., canvas renderer needs width/height)
            const element = createNode(
              tag,
              accumulatedProps as Record<string, unknown>,
              parentContext
            );
            const elRef: ElementRef<TBaseElement> = {
              status: STATUS_ELEMENT,
              element: element,
              parent: null,
              prev: null,
              next: null,
              firstChild: null,
              lastChild: null,
            };

            // Create context for children - they'll see this element as their parent
            const childContext: ParentContext<TBaseElement> = {
              adapter,
              element,
            };

            createElementScope(element, () => {
              for (const [key, val] of Object.entries(accumulatedProps)) {
                // Event handlers are functions but NOT reactive - treat as static
                const isEventHandler = key.startsWith('on');

                if (typeof val !== 'function' || isEventHandler) {
                  setProperty(element, key, val);
                  continue;
                }
                // Reactive value - wrap in effect for updates
                scopedEffect(() =>
                  setProperty(element, key, (val as () => unknown)())
                );
              }
              processChildren(elRef, children, svc, childContext);

              // Execute lifecycle callbacks within scope
              for (const callback of accumulatedCallbacks) {
                const cleanup = callback(element as TElements[Tag]);
                if (cleanup) onCleanup(cleanup);
              }
            });

            return elRef as ElementRef<TElements[Tag]>;
          });
        };

        // Add .props() method
        factory.props = (
          propsOrFn:
            | ElementProps<TConfig, Tag>
            | ((
                current: ElementProps<TConfig, Tag>
              ) => ElementProps<TConfig, Tag>)
        ): TagFactory<TConfig, Tag> => {
          const newProps =
            typeof propsOrFn === 'function'
              ? propsOrFn(accumulatedProps)
              : { ...accumulatedProps, ...propsOrFn };
          return createTagFactory(tag, newProps, accumulatedCallbacks);
        };

        // Add .ref() method
        factory.ref = (
          ...callbacks: LifecycleCallback<TElements[Tag]>[]
        ): TagFactory<TConfig, Tag> => {
          return createTagFactory(tag, accumulatedProps, [
            ...accumulatedCallbacks,
            ...callbacks,
          ]);
        };

        return factory as TagFactory<TConfig, Tag>;
      }

      // Main el function - just selects tag, returns TagFactory
      function el<Tag extends string & TElementKeys>(
        tag: Tag
      ): TagFactory<TConfig, Tag> {
        return createTagFactory(tag, {} as ElementProps<TConfig, Tag>, []);
      }

      const extension: ElFactory<TConfig> = {
        name: 'el',
        impl: el,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
