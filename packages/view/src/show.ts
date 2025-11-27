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
  FragmentRef,
  ElementRef,
  LinkedNode,
} from './types';
import { STATUS_ELEMENT, STATUS_REF_SPEC, STATUS_FRAGMENT } from './types';
import type { Renderer, RendererConfig } from './renderer';
import type { CreateScopes } from './helpers/scope';
import { createNodeHelpers } from './helpers/node-helpers';
import { unlink } from './helpers/linked-list';

/**
 * Options passed to Show factory
 */
export type ShowOpts<TConfig extends RendererConfig> = {
  createElementScope: CreateScopes['createElementScope'];
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  onCleanup: CreateScopes['onCleanup'];
  getElementScope: CreateScopes['getElementScope'];
  renderer: Renderer<TConfig>;
};

export type ShowProps<TBaseElement> = {
  instrument?: (
    impl: ShowFactory<TBaseElement>['impl'],
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => ShowFactory<TBaseElement>['impl'];
};

/**
 * Show factory type - conditionally shows/hides an element without recreation
 *
 * Generic over:
 * - TElement: The element type (must extend base element from renderer config)
 */
export type ShowFactory<TBaseElement> = ServiceDefinition<
  'show',
  {
    <TElement extends TBaseElement>(
      condition: Reactive<boolean>,
      content: RefSpec<TElement>
    ): RefSpec<TElement>;
  }
>;

/**
 * Show primitive - toggles element visibility without recreating it
 *
 * Unlike match(), which recreates elements on every change, show() creates
 * the element once and then attaches/detaches it from the DOM based on the
 * condition signal.
 *
 * Usage:
 * ```typescript
 * // Element is created once, then shown/hidden
 * show(isVisible, el('div', { className: 'card' })(children))
 * ```
 *
 * Key difference from match():
 * - match: recreates element every time (calls .create() repeatedly)
 * - show: creates once, then toggles visibility (preserves element state)
 */
export const Show = defineService(
  <TConfig extends RendererConfig>({
    scopedEffect,
    renderer,
    createElementScope,
    disposeScope,
    onCleanup,
    getElementScope,
  }: ShowOpts<TConfig>) =>
    (props?: ShowProps<TConfig['baseElement']>) => {
      type TBaseElement = TConfig['baseElement'];
      type TFragRef = FragmentRef<TBaseElement>;

      const { instrument } = props ?? {};
      const { insertNodeBefore } = createNodeHelpers({
        renderer,
        disposeScope,
        getElementScope,
      });

      /**
       * Detach a node from DOM WITHOUT disposing its scope
       * This preserves element state and lifecycle for show/hide
       */
      const detachNode = (
        parentElement: TBaseElement,
        node: ElementRef<TBaseElement> | TFragRef
      ): void => {
        if (node.status === STATUS_ELEMENT) {
          // Unlink from doubly-linked list (but don't dispose scope)
          unlink(node);

          // Remove from DOM only
          renderer.removeChild(parentElement, node.element);
          return;
        }

        if (node.status === STATUS_FRAGMENT) {
          // Unlink fragment from parent's list
          unlink(node);

          // Remove all children from DOM (but don't dispose)
          let current = node.firstChild;
          while (current) {
            const next = current.next;

            // Unlink child from fragment's list
            unlink(current);

            // Remove from DOM only (no dispose)
            if (current.status === STATUS_ELEMENT) {
              renderer.removeChild(parentElement, current.element);
            }

            if (current === node.lastChild) break;
            current = next as LinkedNode<TBaseElement>;
          }
        }
      };

      /**
       * Helper to create a RefSpec that accumulates lifecycle callbacks
       * and returns a FragmentRef on creation
       */
      const createShowSpec = <TElement>(
        createFragmentFn: (
          lifecycleCallbacks: LifecycleCallback<TElement>[],
          api?: unknown
        ) => TFragRef
      ): RefSpec<TElement> => {
        const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

        const refSpec: RefSpec<TElement> = (
          ...callbacks: LifecycleCallback<TElement>[]
        ) => {
          lifecycleCallbacks.push(...callbacks);
          return refSpec;
        };

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(api?: unknown, extensions?: TExt) => {
          const fragRef = createFragmentFn(lifecycleCallbacks, api);
          // If no extensions, return the ref directly to preserve mutability
          if (!extensions || Object.keys(extensions).length === 0)
            return fragRef as FragmentRef<TElement> & TExt;

          return {
            ...fragRef,
            ...extensions,
          } as FragmentRef<TElement> & TExt;
        };

        return refSpec;
      };

      function show<TElement extends TBaseElement>(
        condition: Reactive<boolean>,
        content: RefSpec<TElement>
      ): RefSpec<TElement> {
        return createShowSpec<TElement>((lifecycleCallbacks, api) => {
          // Run lifecycle callbacks for element
          const runLifecycleCallbacks = (element: TElement) => {
            createElementScope(element, () => {
              for (const callback of lifecycleCallbacks) {
                const cleanup = callback(element);
                if (cleanup) onCleanup(cleanup);
              }
            });
          };

          let currentNode: ElementRef<TBaseElement> | TFragRef | undefined;

          const fragment: FragmentRef<TBaseElement> = {
            status: STATUS_FRAGMENT,
            element: null,
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
            attach(parent, nextSibling, apiArg) {
              let isAttached = false;

              // Effect tracks the condition signal and updates visibility
              // Use nested effect to isolate updateVisibility from tracking
              return scopedEffect(() => {
                const isVisible = condition();

                // Dispose immediately after it runs
                scopedEffect(() => {
                  if (isVisible) {
                    // Create the element once and cache it (lazy creation)
                    // Only create when first becoming visible to avoid:
                    // 1. SSR registering islands for hidden routes/content
                    // 2. Unnecessary work for content that may never be shown
                    if (!currentNode) {
                      // Create the element/fragment from the spec
                      const nodeRef = content.create(api ?? apiArg);
                      currentNode = nodeRef;

                      // Execute lifecycle callbacks from show level
                      if (nodeRef.status === STATUS_ELEMENT) {
                        runLifecycleCallbacks(nodeRef.element);
                      }
                    }

                    // Only attach if not already attached
                    if (isAttached) return;

                    // Update fragment references to show the element
                    if (currentNode.status === STATUS_FRAGMENT) {
                      fragment.firstChild = currentNode.firstChild;
                      fragment.lastChild = currentNode.lastChild;
                    } else {
                      fragment.firstChild = currentNode;
                      fragment.lastChild = currentNode;
                    }

                    // Attach to DOM
                    insertNodeBefore(
                      api ?? apiArg,
                      parent.element,
                      currentNode,
                      undefined,
                      nextSibling
                    );
                    isAttached = true;

                    return;
                  }

                  // Only detach if currently attached
                  if (!isAttached) return;

                  // Detach from DOM (but keep in memory and preserve scope)
                  detachNode(parent.element, currentNode!);

                  // Clear fragment references when hidden
                  fragment.firstChild = null;
                  fragment.lastChild = null;
                  isAttached = false;
                })();
              });
            },
          };

          return fragment;
        });
      }

      const extension: ShowFactory<TBaseElement> = {
        name: 'show',
        impl: show,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
