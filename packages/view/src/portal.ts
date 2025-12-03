/**
 * Portal primitive - renders children into a different part of the DOM tree
 *
 * Portals allow you to render content outside the normal DOM hierarchy
 * while maintaining the logical component tree for cleanup and reactive scope.
 *
 * Usage:
 * ```typescript
 * // With custom container (appended to document.body)
 * portal(el('div').props({ className: 'modal-backdrop' }))(
 *   el('div').props({ className: 'modal-dialog' })('Content')
 * )
 *
 * // No container - child appended directly to body
 * portal()(tooltipElement)
 * ```
 *
 * The portal's lifecycle is tied to its logical parent - when the parent
 * disposes, the portaled content is automatically cleaned up.
 */

import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type { RefSpec, FragmentRef, ElementRef } from './types';
import { STATUS_REF_SPEC, STATUS_FRAGMENT, STATUS_ELEMENT } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './helpers/scope';
import { createNodeHelpers } from './helpers/node-helpers';

/**
 * Options passed to Portal factory
 */
export type PortalOpts<TConfig extends AdapterConfig> = {
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
  adapter: Adapter<TConfig>;
};

export type PortalProps<TBaseElement> = {
  /**
   * SSR-safe function to get the portal root element.
   * Defaults to document.body in browser environments.
   * Return null to skip portal rendering (e.g., during SSR).
   */
  getPortalRoot?: () => TBaseElement | null;
  instrument?: (
    impl: PortalFactory<TBaseElement>['impl'],
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => PortalFactory<TBaseElement>['impl'];
};

/**
 * Portal factory type - renders children into a portal root (default: document.body)
 *
 * Takes an optional container RefSpec (or null for no container) and a child RefSpec.
 * The container is appended to the portal root, and the child is rendered inside it.
 *
 * Generic over:
 * - TBaseElement: The base element type from renderer config
 */
export type PortalFactory<TBaseElement> = ServiceDefinition<
  'portal',
  {
    <TElement extends TBaseElement>(
      container?: RefSpec<TElement> | null
    ): (child: RefSpec<TElement>) => RefSpec<TElement>;
  }
>;

/**
 * Portal primitive - renders content into a different DOM location
 *
 * Creates a fragment in the logical tree that attaches its children
 * to a different DOM location (portal root). This enables modals,
 * tooltips, and other overlay patterns while preserving:
 * - Reactive scope inheritance
 * - Automatic cleanup when logical parent disposes
 */
export const Portal = defineService(
  <TConfig extends AdapterConfig>({
    adapter,
    disposeScope,
    getElementScope,
  }: PortalOpts<TConfig>) =>
    (props?: PortalProps<TConfig['baseElement']>) => {
      type TBaseElement = TConfig['baseElement'];
      type TFragRef = FragmentRef<TBaseElement>;

      const { instrument, getPortalRoot: customGetPortalRoot } = props ?? {};

      // Default portal root getter - SSR-safe
      const getPortalRoot = customGetPortalRoot ?? (() => {
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
       * Helper to create a RefSpec for portal fragments
       */
      const createPortalSpec = <TElement>(
        createFragmentFn: (api?: unknown) => TFragRef
      ): RefSpec<TElement> => {
        const refSpec = (() => refSpec) as unknown as RefSpec<TElement>;

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(api?: unknown, extensions?: TExt) => {
          const fragRef = createFragmentFn(api);
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
        container?: RefSpec<TElement> | null
      ): (child: RefSpec<TElement>) => RefSpec<TElement> {
        return (child: RefSpec<TElement>) => {
          return createPortalSpec<TElement>((api) => {
            const fragment: FragmentRef<TBaseElement> = {
              status: STATUS_FRAGMENT,
              element: null,
              parent: null,
              prev: null,
              next: null,
              firstChild: null,
              lastChild: null,
              attach(logicalParent, nextSibling) {
                // Portal ignores logical parent and sibling - it attaches to portal root instead
                void logicalParent;
                void nextSibling;

                const portalRoot = getPortalRoot();

                // SSR or no root - skip rendering
                if (!portalRoot) return;

                if (!container) {
                  // No container (null or undefined) - child goes directly into portal root
                  const childRef = child.create(api);
                  insertNodeBefore(api, portalRoot, childRef, undefined, null);

                  return () => {
                    removeNode(portalRoot, childRef);
                  };
                }

                // Container RefSpec provided
                const containerRef = container.create(api) as ElementRef<TElement>;

                if (containerRef.status !== STATUS_ELEMENT) {
                  throw new Error(
                    'Portal container must be an element RefSpec, not a fragment'
                  );
                }

                const containerElement = containerRef.element;

                // Append container to portal root
                adapter.appendChild(portalRoot, containerElement);

                // Create and insert child into container
                const childRef = child.create(api);
                insertNodeBefore(
                  api,
                  containerElement,
                  childRef,
                  undefined,
                  null
                );

                // Return cleanup function
                return () => {
                  // Remove child from container first (handles child scope disposal)
                  removeNode(containerElement, childRef);
                  // Then dispose container scope and remove from portal root
                  const scope = getElementScope(containerElement);
                  if (scope) disposeScope(scope);
                  adapter.removeChild(portalRoot, containerElement);
                };
              },
            };
            return fragment;
          });
        };
      }

      const extension: PortalFactory<TBaseElement> = {
        name: 'portal',
        impl: portal,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
