/**
 * When primitive - conditional children rendering
 *
 * Unlike match(), when() is optimized for truthy conditions where you want
 * to conditionally insert/remove children without rebuilding the parent.
 *
 * Key differences from match():
 * - Takes any Reactive value, coerced to boolean (truthy = show, falsy = hide)
 * - Children are RefSpecs only - use map() for deferred/dynamic rendering
 * - Simpler semantics: show children when truthy, remove when falsy
 * - Parent element is never touched - only children are inserted/removed
 *
 * Usage:
 * ```typescript
 * // Boolean condition
 * when(showDetails,
 *   el('p')('Details go here'),
 *   el('p')('More details')
 * )
 *
 * // Truthy coercion - any reactive works
 * when(userCount,  // 0 = hidden, >0 = shown
 *   el('div')('Users online')
 * )
 *
 * // Recursive structures - compose with map()
 * when(shouldBranch,
 *   map([0, 1, 2], i => Branch(depth + 1))
 * )
 * ```
 */

import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type { RefSpec, Reactive, FragmentRef, NodeRef } from './types';
import { STATUS_REF_SPEC, STATUS_FRAGMENT } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './helpers/scope';
import { createNodeHelpers } from './helpers/node-helpers';

/**
 * Options passed to When factory
 */
export type WhenOpts<TConfig extends AdapterConfig> = {
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  getElementScope: CreateScopes['getElementScope'];
  adapter: Adapter<TConfig>;
};

export type WhenProps<TBaseElement> = {
  instrument?: (
    impl: WhenFactory<TBaseElement>['impl'],
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => WhenFactory<TBaseElement>['impl'];
};

/**
 * When factory type - conditional rendering based on any reactive value (coerced to boolean)
 *
 * Takes any Reactive<T> condition (truthy = show, falsy = hide) and RefSpec children.
 * For deferred/dynamic rendering, compose with map().
 *
 * Generic over:
 * - TBaseElement: The base element type from renderer config
 */
export type WhenFactory<TBaseElement> = ServiceDefinition<
  'when',
  {
    <TElement extends TBaseElement>(
      condition: Reactive<unknown>,
      ...children: RefSpec<TElement>[]
    ): RefSpec<TElement>;
  }
>;

/**
 * When primitive - conditionally renders children based on truthy condition
 *
 * Creates/disposes children when condition changes, without touching parent.
 * Much more efficient than match() for simple show/hide scenarios.
 */
export const When = defineService(
  <TConfig extends AdapterConfig>({
    scopedEffect,
    adapter,
    disposeScope,
    getElementScope,
  }: WhenOpts<TConfig>) =>
    (props?: WhenProps<TConfig['baseElement']>) => {
      type TBaseElement = TConfig['baseElement'];
      type TFragRef = FragmentRef<TBaseElement>;

      const { instrument } = props ?? {};
      const { insertNodeBefore, removeNode } = createNodeHelpers({
        adapter,
        disposeScope,
        getElementScope,
      });

      /**
       * Helper to create a RefSpec for fragments
       */
      const createWhenSpec = <TElement>(
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

      function when<TElement extends TBaseElement>(
        condition: Reactive<unknown>,
        ...childSpecs: RefSpec<TElement>[]
      ): RefSpec<TElement> {
        return createWhenSpec<TElement>((api) => {
            const fragment: FragmentRef<TBaseElement> = {
              status: STATUS_FRAGMENT,
              element: null,
              parent: null,
              prev: null,
              next: null,
              firstChild: null,
              lastChild: null,
              attach(parent, nextSibling) {
                // Track created child nodes for cleanup
                let childNodes: NodeRef<TElement>[] = [];
                let isShowing = false;

                // Create all children and insert them
                const createChildren = () => {
                  for (const spec of childSpecs) {
                    const nodeRef = spec.create(api);

                    // Track in our list
                    childNodes.push(nodeRef);

                    // Update fragment boundaries
                    if (!fragment.firstChild) {
                      fragment.firstChild = nodeRef;
                    }
                    fragment.lastChild = nodeRef;

                    // Link into fragment's child list
                    const prevNode = childNodes[childNodes.length - 2];
                    if (prevNode) {
                      prevNode.next = nodeRef;
                      nodeRef.prev = prevNode;
                    } else {
                      nodeRef.prev = null;
                    }
                    nodeRef.next = null;

                    // Insert into DOM
                    insertNodeBefore(
                      api,
                      parent.element,
                      nodeRef,
                      undefined,
                      nextSibling
                    );
                  }
                };

                // Remove all children
                const removeChildren = () => {
                  for (const nodeRef of childNodes) {
                    removeNode(parent.element, nodeRef);
                  }
                  childNodes = [];
                  fragment.firstChild = null;
                  fragment.lastChild = null;
                };

                // Effect that reacts to condition changes
                return scopedEffect(() => {
                  const shouldShow = !!condition(); // Coerce to boolean

                  if (shouldShow === isShowing) return;

                  if (shouldShow) {
                    // Create and insert children
                    const isolate = scopedEffect(() => {
                      createChildren();
                    });
                    isolate(); // Dispose immediately - children have their own scopes
                  } else {
                    // Remove all children
                    removeChildren();
                  }

                  isShowing = shouldShow;
                });
              },
            };
            return fragment;
          });
      }

      const extension: WhenFactory<TBaseElement> = {
        name: 'when',
        impl: when,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
