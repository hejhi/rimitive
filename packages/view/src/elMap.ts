/**
 * Reactive list primitive
 *
 * elMap() creates a reactive list that efficiently updates the DOM when items
 * are added, removed, or reordered. It uses identity-based tracking by default
 * (no keys required), but supports an optional key function for cases where
 * data objects are recreated.
 *
 * Each item is wrapped in a signal that the render function receives. This
 * allows fine-grained reactivity within each item's DOM.
 */

import type { LatticeExtension } from '@lattice/lattice';
import type {
  Reactive,
  ElementRef,
  DeferredListRef,
  ListItemNode,
} from './types';
import { DEFERRED_LIST_REF, type DeferredListNode } from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { createReconciler } from './helpers/reconcile';
import type { ViewContext } from './context';

/**
 * Options passed to elMap factory
 */
export type ElMapOpts<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode> = {
  ctx: ViewContext;
  signal: <T>(value: T) => Reactive<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
};

/**
 * Factory return type
 */
export type ElMapFactory<TElement extends RendererElement = RendererElement> = LatticeExtension<
  'elMap',
  <T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef<TElement>,
    keyFn: (item: T) => string | number
  ) => DeferredListRef<TElement>
>;


/**
 * Create the elMap primitive factory
 */
export function createElMapFactory<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  opts: ElMapOpts<TElement, TText>
): ElMapFactory<TElement> {
  const { ctx, signal, effect, renderer } = opts;

  // PATTERN: Create reconciler once with closure-captured buffers (like signals)
  const reconcileList = createReconciler();

  function elMap<T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef<TElement>,
    keyFn: (item: T) => string | number
  ): DeferredListRef<TElement> {
    let dispose: (() => void) | undefined;

    // PATTERN: Create internal node (like signals creates SignalNode)
    // Element is null until parent is provided
    // Store itemsByKey on node (like signals stores deps on node)
    const node: DeferredListNode<TElement> = {
      refType: DEFERRED_LIST_REF,
      element: null,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, TElement>>(),
    };

    // PATTERN: Create ref function that closes over node (like signal function)
    const deferredRef = ((parent: TElement): void => {
      // Store parent in node
      node.element = parent;

      // Create an effect that reconciles the list when items change
      // PATTERN: Effect automatically schedules via scheduler (like signals/effect.ts)
      dispose = effect(() => {
        const currentItems = itemsSignal();

        // PATTERN: Snapshot linked list to get previous items (single source of truth)
        // This eliminates redundant state and prevents sync bugs
        const oldItems: T[] = [];
        let current = node.firstChild;
        while (current) {
          oldItems.push((current as ListItemNode<T, TElement>).itemData);
          current = current.nextSibling;
        }

        reconcileList<T, TElement, TText>(
          ctx,
          node,  // ← Pass DeferredListNode directly
          oldItems,
          currentItems,
          (item: T) => {
            // PATTERN: Create signal once and reuse (like graph-edges.ts reuses deps)
            // This signal will be updated by reconcileList when item data changes
            const itemSignal = signal(item);

            // Render the item using the provided render function
            const elementRef = render(itemSignal);

            // Store item metadata including signal for updates
            const key = String(keyFn(item));
            (node.itemsByKey as Map<string, ListItemNode<T, TElement>>).set(key, {
              refType: 0,
              key,
              element: elementRef.node.element,
              itemData: item,
              itemSignal,
              parentList: undefined,
              previousSibling: undefined,
              nextSibling: undefined,
            });

            return elementRef.node.element;
          },
          keyFn,
          renderer
        );
      });

      // Track dispose in parent's scope
      // PATTERN: Parent owns the lifecycle
      const parentScope = ctx.elementScopes.get(parent);
      if (parentScope) {
        const disposeNode = {
          disposable: { dispose },
          next: parentScope.firstDisposable,
        };
        parentScope.firstDisposable = disposeNode;
      }
    }) as DeferredListRef<TElement>;

    // Attach node to ref (internal state, exposed for helpers)
    deferredRef.node = node;

    return deferredRef;
  }

  return {
    name: 'elMap',
    method: elMap,
  };
}
