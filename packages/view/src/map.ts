/**
 * User-space map() helper using stable signal pattern
 */

import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type {
  RefSpec,
  FragmentRef,
  Reactive,
  ElementRef,
  Writable,
} from './types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_REF_SPEC } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './helpers/scope';
import { createReconciler, ReconcileNode } from './helpers/reconcile';
import { createNodeHelpers } from './helpers/node-helpers';
import { removeFromFragment } from './helpers/fragment-boundaries';

/**
 * Map factory type
 *
 * Items can be a static array or a reactive signal of array.
 * The render callback receives a signal wrapping each item, enabling
 * reactive updates without recreating elements.
 *
 * When the source array updates, map pushes new values into the item
 * signals, triggering reactive updates in computeds that read them.
 *
 * Note: Uses function overloads with Writable first to ensure proper
 * type inference when passing signals directly.
 *
 * @example
 * ```ts
 * // Without key function (for primitives)
 * map(['a', 'b', 'c'], (item) => el('li')(item))
 *
 * // With key function (for objects)
 * map(users, (u) => u.id, (user) => el('li')(user().name))
 * ```
 */
export type MapFactory<TBaseElement> = ServiceDefinition<
  'map',
  {
    // 3-arg overloads (with key function) - must come first
    // Overload 1a: Writable items (signal-like) - for proper inference
    <T, TEl>(
      items: Writable<T[]>,
      keyFn: (item: T) => string | number,
      render: (itemSignal: Reactive<T>) => RefSpec<TEl>
    ): RefSpec<TBaseElement>;
    // Overload 1b: Plain getter or static array
    <T, TEl>(
      items: T[] | (() => T[]),
      keyFn: (item: T) => string | number,
      render: (itemSignal: Reactive<T>) => RefSpec<TEl>
    ): RefSpec<TBaseElement>;

    // 2-arg overloads (without key function) - for primitives
    // Overload 2a: Writable items (signal-like) - for proper inference
    <T, TEl>(
      items: Writable<T[]>,
      render: (itemSignal: Reactive<T>) => RefSpec<TEl>
    ): RefSpec<TBaseElement>;
    // Overload 2b: Plain getter or static array
    <T, TEl>(
      items: T[] | (() => T[]),
      render: (itemSignal: Reactive<T>) => RefSpec<TEl>
    ): RefSpec<TBaseElement>;
  }
>;

export interface MapOpts<TConfig extends AdapterConfig> {
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  computed: <T>(fn: () => T) => Reactive<T>;
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  adapter: Adapter<TConfig>;
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
}

export interface MapProps<TBaseElement> {
  instrument?: (
    impl: MapFactory<TBaseElement>['impl'],
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => MapFactory<TBaseElement>['impl'];
}

// RecNode stores the item signal (not the item value) for reactive updates
type ItemSignal<T> = Reactive<T> & ((value: T) => void);
type RecNode<T, TElement> = ElementRef<TElement> & ReconcileNode<ItemSignal<T>>;

/**
 * Map primitive - instantiatable extension using the create pattern
 * Similar to Signal() in signals preset
 */
export const Map = defineService(
  <TConfig extends AdapterConfig>({
    signal,
    computed,
    scopedEffect,
    adapter,
    disposeScope,
    getElementScope,
  }: MapOpts<TConfig>) =>
    (props?: MapProps<TConfig['baseElement']>) => {
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
      const createRefSpec = (
        createFragmentRef: (api?: unknown) => TFragRef
      ): RefSpec<TBaseElement> => {
        const refSpec = (() => refSpec) as unknown as RefSpec<TBaseElement>;

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(api?: unknown, extensions?: TExt) => {
          const fragRef = createFragmentRef(api);
          if (!extensions || Object.keys(extensions).length === 0)
            return fragRef;

          return {
            ...fragRef,
            ...extensions,
          };
        };

        return refSpec;
      };

      // Overload signatures for proper type inference
      function map<T, TEl>(
        items: Writable<T[]>,
        keyFn: (item: T) => string | number,
        render: (itemSignal: Reactive<T>) => RefSpec<TEl>
      ): RefSpec<TBaseElement>;
      function map<T, TEl>(
        items: T[] | (() => T[]),
        keyFn: (item: T) => string | number,
        render: (itemSignal: Reactive<T>) => RefSpec<TEl>
      ): RefSpec<TBaseElement>;
      function map<T, TEl>(
        items: Writable<T[]>,
        render: (itemSignal: Reactive<T>) => RefSpec<TEl>
      ): RefSpec<TBaseElement>;
      function map<T, TEl>(
        items: T[] | (() => T[]),
        render: (itemSignal: Reactive<T>) => RefSpec<TEl>
      ): RefSpec<TBaseElement>;
      // Implementation handles all overloads
      function map<T, TEl>(
        items: T[] | Writable<T[]> | (() => T[]),
        keyFnOrRender:
          | ((item: T) => string | number)
          | ((itemSignal: Reactive<T>) => RefSpec<TEl>),
        maybeRender?: (itemSignal: Reactive<T>) => RefSpec<TEl>
      ): RefSpec<TBaseElement> {
        // Determine which overload was used
        const keyFn = maybeRender
          ? (keyFnOrRender as (item: T) => string | number)
          : undefined;
        const render = maybeRender
          ? maybeRender
          : (keyFnOrRender as (itemSignal: Reactive<T>) => RefSpec<TEl>);

        type TRecNode = RecNode<T, TBaseElement>;

        return createRefSpec((api) => {
          const fragment: FragmentRef<TBaseElement> = {
            status: STATUS_FRAGMENT,
            element: null,
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
            attach(parent, nextSibling) {
              // Don't capture parent.element - always dereference it at call time
              // This allows the parent element to be updated (e.g., after unwrapping fragment containers)
              // and have the reconciler pick up the new value

              // nextSibling from fragment can be NodeRef (element/comment/fragment), but map only uses elements
              // Filter to element refs only for reconciliation
              const nextElementSibling =
                nextSibling && nextSibling.status === STATUS_ELEMENT
                  ? (nextSibling as TRecNode)
                  : undefined;

              // Create reconciler with internal state management and hooks
              const { reconcile, dispose } = createReconciler<
                T,
                TBaseElement,
                TRecNode
              >({
                parentElement: parent.element,
                parentRef: parent,
                nextSibling: nextElementSibling,

                onCreate: (item) => {
                  // Create internal signal for reactive updates
                  const itemSignal = signal<T>(
                    typeof item === 'function'
                      ? item() // Unwrap if item is already a signal
                      : item // Otherwise return directly
                  );

                  // Wrap in computed for read-only access to user
                  const readOnlyItem = computed(() => itemSignal());

                  let elRef: TRecNode;

                  // This is a reactive ("hot") closure because reconcile() runs inside a scopedEffect below.
                  // We isolate the render() call in an inner, temporary effect to protect it from getting
                  // caught in the parent effect.
                  const isolate = scopedEffect(() => {
                    // Pass read-only computed to render
                    elRef = render(readOnlyItem).create<TRecNode>(api);

                    // Insert into DOM
                    insertNodeBefore(
                      api,
                      parent.element,
                      elRef,
                      undefined,
                      nextSibling
                    );

                    // Update fragment boundaries and link items
                    if (!fragment.firstChild) {
                      fragment.firstChild = elRef;
                      fragment.lastChild = elRef;
                      elRef.prev = null;
                      elRef.next = null;
                    } else {
                      const prevLast = fragment.lastChild;
                      if (prevLast) {
                        prevLast.next = elRef;
                        elRef.prev = prevLast;
                      }
                      elRef.next = null;
                      fragment.lastChild = elRef;
                    }

                    // Store the signal (not the item) for updates
                    elRef.data = itemSignal;
                  });

                  isolate(); // Dispose immediately after it runs
                  return elRef!;
                },

                // onUpdate: push new value into the item signal
                // No recreation needed - computeds will react to signal change
                onUpdate(item, node) {
                  // Push into our internal signal
                  node.data(typeof item === 'function' ? item() : item);
                },

                // onMove: called when item needs repositioning
                onMove(node, nextSiblingNode) {
                  if (node.status !== STATUS_ELEMENT) return;
                  insertNodeBefore(
                    api,
                    parent.element,
                    node,
                    nextSiblingNode,
                    nextSibling
                  );
                },

                // onRemove: called when item is being removed
                onRemove(node) {
                  if (node.status !== STATUS_ELEMENT) return;

                  // Update fragment boundaries if removing a boundary node
                  removeFromFragment(fragment, node);
                  removeNode(parent.element, node);
                },
              });

              // Create effect within parent's scope - auto-tracked!
              const effectDispose = scopedEffect(() => {
                // Get items - handle both array and function
                const itemsArray =
                  typeof items === 'function' ? items() : items;

                // Validate: require key function when mapping over objects
                if (!keyFn && itemsArray.length > 0) {
                  const firstItem = itemsArray[0];
                  // Check if it's an object (not null, not array, not primitive)
                  if (
                    firstItem !== null &&
                    typeof firstItem === 'object' &&
                    !Array.isArray(firstItem)
                  ) {
                    throw new Error(
                      'map() requires a key function when mapping over objects. ' +
                        'Without a key function, all objects become "[object Object]" which breaks reconciliation. ' +
                        'Example: map(items, (item) => item.id, (item) => ...)'
                    );
                  }
                }

                // Reconcile with just items and key function
                reconcile(itemsArray, (item) =>
                  keyFn ? keyFn(item) : (item as string | number)
                );
              });

              // Return cleanup function
              return () => {
                effectDispose();
                dispose();
              };
            },
          };
          return fragment;
        });
      }

      const extension: MapFactory<TBaseElement> = {
        name: 'map',
        impl: map,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
