/**
 * Portal primitive - renders children into a different part of the DOM tree
 *
 * Portals allow you to render content outside the normal DOM hierarchy
 * while maintaining the logical component tree for cleanup and reactive scope.
 *
 * Usage:
 * ```typescript
 * // Portal to document.body (default)
 * portal()(
 *   el('div').props({ className: 'modal-backdrop' })(
 *     el('div').props({ className: 'modal' })('Content')
 *   )
 * )
 *
 * // Portal to a specific element via signal ref
 * const modalRoot = signal<HTMLElement | null>(null);
 * el('div').ref((el) => { modalRoot(el); return () => modalRoot(null); })
 * portal(modalRoot)(tooltipContent)
 *
 * // Portal to element via getter
 * portal(() => document.getElementById('modal-root'))(content)
 * ```
 *
 * The portal's lifecycle is tied to its logical parent - when the parent
 * disposes, the portaled content is automatically cleaned up.
 */

import type { RefSpec, FragmentRef } from './types';
import { STATUS_REF_SPEC, STATUS_FRAGMENT } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './deps/scope';
import { ScopesModule } from './deps/scope';
import { createNodeHelpers } from './deps/node-deps';
import { setFragmentChild } from './deps/fragment-boundaries';
import { defineModule, type Module } from '@lattice/lattice';

/**
 * Portal target - where content should be rendered
 * - undefined: use default (document.body)
 * - Element: use directly
 * - () =\> Element | null: getter/signal (called to resolve target)
 */
export type PortalTarget<TElement> =
  | TElement
  | (() => TElement | null)
  | undefined;

/**
 * Options passed to Portal factory
 */
export type PortalOpts<TConfig extends AdapterConfig> = {
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  adapter: Adapter<TConfig>;
};

export type PortalProps<TBaseElement> = {
  /**
   * SSR-safe function to get the default portal target.
   * Used when no target is provided to portal().
   * Defaults to document.body in browser environments.
   * Return null to skip portal rendering (e.g., during SSR).
   */
  getDefaultTarget?: () => TBaseElement | null;
};

/**
 * Portal factory type - renders children into a target element
 *
 * Takes an optional target (element, getter, or signal) and a child RefSpec.
 * The child is rendered into the target element.
 *
 * Generic over:
 * - TBaseElement: The base element type from renderer config
 */
export type PortalFactory<TBaseElement> = <TElement extends TBaseElement>(
  target?: PortalTarget<TElement>
) => (child: RefSpec<TElement>) => RefSpec<TElement>;

/**
 * Portal service type - alias for PortalFactory for consistency with other view primitives.
 *
 * Use this type when building custom view service compositions:
 * @example
 * ```ts
 * import { createPortalFactory, type PortalService } from '@lattice/view/portal';
 * import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
 *
 * const portal: PortalService<DOMAdapterConfig> = createPortalFactory({
 *   adapter,
 *   disposeScope,
 *   getElementScope,
 *   scopedEffect,
 * })();
 * ```
 */
export type PortalService<TConfig extends AdapterConfig> = PortalFactory<
  TConfig['baseElement']
>;

/**
 * Create a portal factory with the given dependencies.
 *
 * Portals render content into a different DOM location while maintaining
 * the logical component tree for cleanup and reactive scope.
 *
 * @example
 * ```ts
 * const portal = createPortalFactory({
 *   adapter,
 *   disposeScope,
 *   getElementScope,
 *   scopedEffect,
 * });
 *
 * // Portal to document.body (default)
 * portal()(
 *   el('div').props({ className: 'modal-backdrop' })('Content')
 * )
 *
 * // Portal to a specific element via signal ref
 * const modalRoot = signal<HTMLElement | null>(null);
 * portal(modalRoot)(tooltipContent)
 * ```
 */
export function createPortalFactory<TConfig extends AdapterConfig>({
  adapter,
  disposeScope,
  getElementScope,
  scopedEffect,
}: PortalOpts<TConfig>): (
  props?: PortalProps<TConfig['baseElement']>
) => PortalFactory<TConfig['baseElement']> {
  return (props?: PortalProps<TConfig['baseElement']>) => {
    type TBaseElement = TConfig['baseElement'];
    type TFragRef = FragmentRef<TBaseElement>;

    const { getDefaultTarget: customGetDefaultTarget } = props ?? {};

    // Default target getter - SSR-safe
    const getDefaultTarget =
      customGetDefaultTarget ??
      (() => {
        if (typeof document !== 'undefined') {
          return document.body as TBaseElement;
        }
        return null;
      });

    const { insertNodeBefore, removeNode } = createNodeHelpers({
      adapter,
      disposeScope,
      getElementScope,
    });

    /**
     * Resolve target to an element
     */
    const resolveTarget = <TElement extends TBaseElement>(
      target: PortalTarget<TElement>
    ): TElement | null => {
      if (target === undefined) {
        return getDefaultTarget() as TElement | null;
      }
      if (typeof target === 'function') {
        return (target as () => TElement | null)();
      }
      return target;
    };

    /**
     * Helper to create a RefSpec for portal fragments
     */
    const createPortalSpec = <TElement>(
      createFragmentFn: (svc?: unknown) => TFragRef
    ): RefSpec<TElement> => {
      const refSpec = (() => refSpec) as unknown as RefSpec<TElement>;

      refSpec.status = STATUS_REF_SPEC;
      refSpec.create = <TExt>(svc?: unknown, extensions?: TExt) => {
        const fragRef = createFragmentFn(svc);
        if (!extensions || Object.keys(extensions).length === 0)
          return fragRef as FragmentRef<TElement> & TExt;

        return {
          ...fragRef,
          ...extensions,
        } as FragmentRef<TElement> & TExt;
      };

      return refSpec;
    };

    function portal<TElement extends TBaseElement>(
      target?: PortalTarget<TElement>
    ): (child: RefSpec<TElement>) => RefSpec<TElement> {
      // Static target (element or undefined) - no reactivity needed
      const isStaticTarget =
        target === undefined || typeof target !== 'function';

      return (child: RefSpec<TElement>) => {
        return createPortalSpec<TElement>((svc) => {
          const fragment: FragmentRef<TBaseElement> = {
            status: STATUS_FRAGMENT,
            element: null,
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
            attach() {
              if (isStaticTarget) {
                // Static target - simple insert, no effect needed
                const targetElement = resolveTarget(target);
                if (!targetElement) return;

                const childRef = child.create(svc);
                setFragmentChild(fragment, childRef);
                insertNodeBefore(svc, targetElement, childRef, undefined, null);

                return () => {
                  setFragmentChild(fragment, null);
                  removeNode(targetElement, childRef);
                };
              }

              // Reactive target (function/signal) - track changes
              // Each target change recreates the child (state is lost, but
              // this matches expected portal behavior when moving containers)
              return scopedEffect(() => {
                const targetElement = resolveTarget(target);

                // No target - nothing to render
                if (!targetElement) {
                  setFragmentChild(fragment, null);
                  return;
                }

                // Create and insert child
                const childRef = child.create(svc);
                setFragmentChild(fragment, childRef);
                insertNodeBefore(svc, targetElement, childRef, undefined, null);

                // Cleanup when target changes or portal disposes
                return () => {
                  setFragmentChild(fragment, null);
                  removeNode(targetElement, childRef);
                };
              });
            },
          };
          return fragment;
        });
      };
    }

    return portal;
  };
}

/**
 * Create a Portal module for a given adapter.
 *
 * @example
 * ```ts
 * import { compose } from '@lattice/lattice';
 * import { createPortalModule } from '@lattice/view/portal';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 * const PortalModule = createPortalModule(adapter);
 *
 * const { portal } = compose(PortalModule)();
 * ```
 */
export const createPortalModule = <TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>,
  props?: PortalProps<TConfig['baseElement']>
): Module<
  'portal',
  PortalFactory<TConfig['baseElement']>,
  { scopes: CreateScopes }
> =>
  defineModule({
    name: 'portal',
    dependencies: [ScopesModule],
    create: ({ scopes }: { scopes: CreateScopes }) =>
      createPortalFactory({
        adapter,
        ...scopes,
      })(props),
  });
