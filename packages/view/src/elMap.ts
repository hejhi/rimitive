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
 * Generic over element type - instantiate with specific renderer element type
 * Example: ElMapFactory<HTMLElement> for DOM
 */
export type ElMapFactory<TElement extends RendererElement = RendererElement> = LatticeExtension<
  'elMap',
  <T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef,
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
  const { reconcileList } = createReconciler();

  function elMap<T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef<TElement>,
    keyFn: (item: T) => string | number
  ): DeferredListRef<TElement> {
    let dispose: (() => void) | undefined;

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

        // PATTERN: Pass linked list head directly to reconciler (single source of truth)
        // This eliminates array allocation and prevents sync bugs
        reconcileList<T, TElement, TText>(
          ctx,
          node,  // ← Pass DeferredListNode directly
          currentItems,
          (itemData: T) => {
            // PATTERN: Render callback only creates DOM element
            // Reconciler will wrap it in ListItemNode
            const itemSignal = signal(itemData);
            const elementRef = render(itemSignal);

            return {
              element: elementRef.node.element,
              itemSignal,
            };
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
    method: elMap as ElMapFactory<TElement>['method'],
  };
}
