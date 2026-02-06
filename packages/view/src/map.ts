/**
 * map() - Reactive list rendering
 *
 * Uses reconcile() for minimal DOM operations when arrays change.
 */

import type {
  RefSpec,
  FragmentRef,
  Reactive,
  ElementRef,
  Writable,
} from './types';
import { STATUS_FRAGMENT, STATUS_REF_SPEC } from './types';
import type { Adapter, TreeConfig, NodeOf } from './adapter';
import type { CreateScopes } from './deps/scope';
import { ScopesModule } from './deps/scope';
import { createNodeHelpers } from './deps/node-deps';
import {
  removeFromFragment,
  updateBoundariesAfterInsert,
} from './deps/fragment-boundaries';
import {
  defineModule,
  type Module,
  STATUS_MODULE,
  PLACEHOLDER,
  type InstrumentationContext,
  getCallerLocationFull,
  type SourceLocation,
} from '@rimitive/core';
import {
  SignalModule,
  type SignalFactory,
  type SignalFunction,
} from '@rimitive/signals/signal';
import {
  ComputedModule,
  type ComputedFactory,
} from '@rimitive/signals/computed';
import {
  IterModule,
  type IterFactory,
  type Iter,
} from '@rimitive/signals/iter';
import { reconcile } from '@rimitive/signals/reconcile';
import { UntrackModule } from '@rimitive/signals/untrack';

export type MapFactory<TBaseElement> = {
  // Array input with key function
  <T, TEl>(
    items: Writable<T[]>,
    keyFn: (item: T) => string | number,
    render: (itemSignal: Reactive<T>) => RefSpec<TEl>
  ): RefSpec<TBaseElement>;
  <T, TEl>(
    items: T[] | (() => T[]),
    keyFn: (item: T) => string | number,
    render: (itemSignal: Reactive<T>) => RefSpec<TEl>
  ): RefSpec<TBaseElement>;

  // Array input without key function (primitives only)
  <T, TEl>(
    items: Writable<T[]>,
    render: (itemSignal: Reactive<T>) => RefSpec<TEl>
  ): RefSpec<TBaseElement>;
  <T, TEl>(
    items: T[] | (() => T[]),
    render: (itemSignal: Reactive<T>) => RefSpec<TEl>
  ): RefSpec<TBaseElement>;
};

type MapOpts<TConfig extends TreeConfig> = {
  signal: SignalFactory;
  computed: <T>(fn: () => T) => Reactive<T>;
  iter: IterFactory;
  untrack: <T>(fn: () => T) => T;
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  adapter: Adapter<TConfig>;
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
  withScope: CreateScopes['withScope'];
  createChildScope: CreateScopes['createChildScope'];
};

type ItemData<T, TElement> = {
  itemSignal: SignalFunction<T>;
  elRef: ElementRef<TElement>;
  scope: ReturnType<CreateScopes['createChildScope']>;
};

export function createMapFactory<TConfig extends TreeConfig>({
  signal,
  computed,
  iter,
  untrack,
  scopedEffect,
  adapter,
  disposeScope,
  getElementScope,
  withScope,
  createChildScope,
}: MapOpts<TConfig>): MapFactory<NodeOf<TConfig>> {
  type TBaseElement = NodeOf<TConfig>;

  const { insertNodeBefore, removeNode } = createNodeHelpers({
    adapter,
    disposeScope,
    getElementScope,
  });

  // Overloads
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
  function map<T, TEl>(
    items: T[] | Writable<T[]> | (() => T[]),
    keyFnOrRender:
      | ((item: T) => string | number)
      | ((itemSignal: Reactive<T>) => RefSpec<TEl>),
    maybeRender?: (itemSignal: Reactive<T>) => RefSpec<TEl>
  ): RefSpec<TBaseElement> {
    const keyFn = maybeRender
      ? (keyFnOrRender as (item: T) => string | number)
      : undefined;
    const render = maybeRender
      ? maybeRender
      : (keyFnOrRender as (itemSignal: Reactive<T>) => RefSpec<TEl>);

    const iterKeyFn =
      keyFn ?? ((item: T) => item as unknown as string | number);

    const refSpec = (() => refSpec) as unknown as RefSpec<TBaseElement>;
    refSpec.status = STATUS_REF_SPEC;
    refSpec.create = <TExt>(svc?: unknown, extensions?: TExt) => {
      const fragment: FragmentRef<TBaseElement> = {
        status: STATUS_FRAGMENT,
        element: null,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
        attach(parent, nextSibling) {
          type TData = ItemData<T, TBaseElement>;

          // Internal iter to track items
          const list: Iter<TData> = iter<TData>((d) =>
            iterKeyFn(d.itemSignal.peek())
          );

          const createItem = (item: T): TData => {
            const itemSignal: SignalFunction<T> = signal<T>(
              typeof item === 'function' ? item() : item
            );
            const readOnlyItem = computed(() => itemSignal());
            const itemScope = createChildScope();
            let elRef: ElementRef<TBaseElement>;
            const isolate = scopedEffect(() => {
              elRef = withScope(itemScope, () =>
                render(readOnlyItem).create<ElementRef<TBaseElement>>(svc)
              );
            });
            isolate();

            return { itemSignal, elRef: elRef!, scope: itemScope };
          };

          const insertData = (
            data: TData,
            beforeRef: ElementRef<TBaseElement> | null
          ) => {
            // Link into fragment's doubly-linked list
            data.elRef.next = beforeRef;
            if (beforeRef) {
              data.elRef.prev = beforeRef.prev;
              if (beforeRef.prev) beforeRef.prev.next = data.elRef;
              beforeRef.prev = data.elRef;
            } else {
              data.elRef.prev = fragment.lastChild;
              if (fragment.lastChild) fragment.lastChild.next = data.elRef;
            }
            updateBoundariesAfterInsert(
              fragment,
              data.elRef,
              beforeRef ?? undefined
            );
            insertNodeBefore(
              svc,
              parent.element,
              data.elRef,
              beforeRef,
              nextSibling
            );
          };

          const removeData = (data: TData) => {
            // Unlink from doubly-linked list
            if (data.elRef.prev) data.elRef.prev.next = data.elRef.next;
            if (data.elRef.next) data.elRef.next.prev = data.elRef.prev;
            disposeScope(data.scope);
            removeFromFragment(fragment, data.elRef);
            removeNode(parent.element, data.elRef);
          };

          const moveData = (
            data: TData,
            beforeRef: ElementRef<TBaseElement> | null
          ) => {
            // Unlink from current position
            if (data.elRef.prev) data.elRef.prev.next = data.elRef.next;
            if (data.elRef.next) data.elRef.next.prev = data.elRef.prev;
            removeFromFragment(fragment, data.elRef);

            // Link at new position
            data.elRef.next = beforeRef;
            if (beforeRef) {
              data.elRef.prev = beforeRef.prev;
              if (beforeRef.prev) beforeRef.prev.next = data.elRef;
              beforeRef.prev = data.elRef;
            } else {
              data.elRef.prev = fragment.lastChild;
              if (fragment.lastChild) fragment.lastChild.next = data.elRef;
            }
            updateBoundariesAfterInsert(
              fragment,
              data.elRef,
              beforeRef ?? undefined
            );

            adapter.removeChild(parent.element, data.elRef.element);
            adapter.insertBefore(
              parent.element,
              data.elRef.element,
              beforeRef?.element ?? null
            );
          };

          const effectDispose = scopedEffect(() => {
            // Track only the items source - this is the reactivity trigger
            const itemsArray = typeof items === 'function' ? items() : items;

            // Untrack everything else to prevent accidental dependencies
            // on internal iter signals during reconciliation
            untrack(() => {
              // Validate: require key function when mapping over objects
              if (!keyFn && itemsArray.length > 0) {
                const first = itemsArray[0];
                if (
                  first !== null &&
                  typeof first === 'object' &&
                  !Array.isArray(first)
                ) {
                  throw new Error(
                    'map() requires a key function when mapping over objects. ' +
                      'Without a key function, all objects become "[object Object]" which breaks reconciliation. ' +
                      'Example: map(items, (item) => item.id, (item) => ...)'
                  );
                }
              }

              // Build new data array, reusing existing items where possible
              const newDataArray: TData[] = itemsArray.map((item) => {
                const key = iterKeyFn(item);
                const existing = list.get(key);
                if (existing) {
                  // Update signal with new value
                  existing.itemSignal(typeof item === 'function' ? item() : item);
                  return existing;
                }
                return createItem(item);
              });

              // Reconcile - iter is mutated directly, callbacks handle DOM only
              reconcile(list, newDataArray, {
                onInsert: (node, beforeNode) => {
                  insertData(node.value, beforeNode?.value.elRef ?? null);
                },
                onRemove: (node) => {
                  removeData(node.value);
                },
                onMove: (node, beforeNode) => {
                  moveData(node.value, beforeNode?.value.elRef ?? null);
                },
                // Updates handled above when building newDataArray
              });
            });
          });

          return () => {
            effectDispose();
            for (const data of list.peek()) {
              disposeScope(data.scope);
              removeNode(parent.element, data.elRef);
            }
            list.clear();
          };
        },
      };

      if (!extensions || Object.keys(extensions).length === 0) return fragment;
      return { ...fragment, ...extensions };
    };
    return refSpec;
  }

  return map;
}

/**
 * Placeholder module for use in dependency arrays.
 * The actual module is created via MapModule.with({ adapter }).
 */
const mapModulePlaceholder = {
  status: STATUS_MODULE as typeof STATUS_MODULE,
  name: 'map' as const,
  dependencies: [SignalModule, ComputedModule, IterModule, UntrackModule, ScopesModule],
  [PLACEHOLDER]: true as const,
  create: (): MapFactory<Node> => {
    throw new Error(
      'Module "map" requires configuration. ' +
      'Use MapModule.with({ adapter }) when composing.'
    );
  },
};

/**
 * Map module - reactive list rendering primitive.
 *
 * Requires configuration via .with() before composing.
 * Use MapModule.module in dependency arrays to declare dependency.
 *
 * @example
 * ```ts
 * import { compose } from '@rimitive/core';
 * import { MapModule } from '@rimitive/view/map';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(
 *   SignalModule,
 *   ComputedModule,
 *   MapModule.with({ adapter }),
 * );
 *
 * const { map } = svc;
 * ```
 */
export const MapModule = {
  name: 'map' as const,
  module: mapModulePlaceholder,

  with<TConfig extends TreeConfig>(config: {
    adapter: Adapter<TConfig>;
  }): Module<
    'map',
    MapFactory<NodeOf<TConfig>>,
    {
      signal: SignalFactory;
      computed: ComputedFactory;
      iter: IterFactory;
      untrack: <T>(fn: () => T) => T;
      scopes: CreateScopes;
    }
  > {
    return defineModule({
      name: 'map',
      dependencies: [SignalModule, ComputedModule, IterModule, UntrackModule, ScopesModule],
      create: ({ signal, computed, iter, untrack, scopes }) =>
        createMapFactory({ adapter: config.adapter, signal, computed, iter, untrack, ...scopes }),
      instrument(
        impl: MapFactory<NodeOf<TConfig>>,
        instr: InstrumentationContext
      ): MapFactory<NodeOf<TConfig>> {
        type TBaseElement = NodeOf<TConfig>;

        // Wrap the map function to emit events
        function instrumentedMap<T, TEl>(
          items: Writable<T[]> | T[] | (() => T[]),
          keyFnOrRender:
            | ((item: T) => string | number)
            | ((itemSignal: Reactive<T>) => RefSpec<TEl>),
          maybeRender?: (itemSignal: Reactive<T>) => RefSpec<TEl>
        ): RefSpec<TBaseElement> {
          const location = getCallerLocationFull();
          const sourceLocation: SourceLocation | undefined = location;
          const hasKeyFn = maybeRender !== undefined;

          instr.emit({
            type: 'map:create',
            timestamp: Date.now(),
            data: {
              hasKeyFn,
              sourceLocation,
            },
          });

          // Call the original implementation with proper arguments
          if (maybeRender) {
            return impl(
              items as Writable<T[]>,
              keyFnOrRender as (item: T) => string | number,
              maybeRender
            );
          }
          return impl(
            items as Writable<T[]>,
            keyFnOrRender as (itemSignal: Reactive<T>) => RefSpec<TEl>
          );
        }

        return instrumentedMap as MapFactory<TBaseElement>;
      },
    });
  },
};
