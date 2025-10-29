/**
 * User-space map() helper using stable signal pattern
 *
 * Key design principles:
 * - Render callback runs ONCE per key (no orphaned computeds)
 * - Each item gets a stable signal that map() updates
 * - Keys extracted from el() calls (no separate keyFn parameter)
 * - Efficient reconciliation with LIS algorithm
 */

import type { RefSpec, ElementRef, NodeRef, FragmentRef, Reactive, RenderScope } from '../types';
import { isElementRef, resolveNextRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { createReconciler } from './reconcile';
import { createFragment } from './fragment';
import type { GlobalContext } from '@lattice/signals/context';
import { createUntracked } from '@lattice/signals/untrack';

export interface MapHelperOpts<
  TElement extends RendererElement,
  TText extends TextNode
> {
  ctx: LatticeContext;
  signalCtx: GlobalContext;
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  disposeScope: CreateScopes['disposeScope'];
}

/**
 * Create a map helper with injected dependencies
 *
 * This is a factory that returns the map() function with access to
 * renderer, ctx, and other utilities
 */
export function createMapHelper<
  TElement extends RendererElement,
  TText extends TextNode
>(opts: MapHelperOpts<TElement, TText>) {
  const { ctx, signalCtx, signal, scopedEffect, renderer, disposeScope } = opts;
  const untrack = createUntracked({ ctx: signalCtx });

  function map<T>(
    items: () => T[],
    render: (itemSignal: Reactive<T>) => RefSpec<TElement>,
    keyFn?: (item: T) => string | number
  ): FragmentRef<TElement> {
    return createFragment((parent: ElementRef<TElement>, nextSibling?: NodeRef<TElement> | null) => {
      // Store signals, RefSpecs, and scopes per key (separate from reconciliation)
      type ItemEntry = {
        signal: Reactive<T> & ((value: T) => void);
        scope: RenderScope;
      };
      const itemData = new Map<unknown, ItemEntry>();
      const parentEl = parent.element;

      // Create reconciler with internal state management and hooks
      const { reconcile, dispose } = createReconciler<T, TElement>({
        parentElement: parentEl,
        parentRef: parent,
        nextSibling: nextSibling ?? undefined,

        onCreate: untrack(() => (item, key) => {
          const itemSignal = signal(item);

          // Render the item - this creates an element with its own scope
          const elRef = render(itemSignal).create() as ElementRef<TElement>;

          // Get the scope that was created for this element
          const scope = ctx.elementScopes.get(elRef.element);
          if (!scope) {
            throw new Error('map: expected rendered element to have a registered scope');
          }

          itemData.set(key, { scope, signal: itemSignal });

          renderer.insertBefore(
            parentEl,
            elRef.element,
            resolveNextRef(nextSibling)?.element ?? null
          );

          return elRef;
        }),

        // onUpdate: called when existing item's data should be updated
        onUpdate: (key, item) => {
          const existing = itemData.get(key);
          if (existing) existing.signal(item);
        },

        // onMove: called when item needs repositioning
        onMove: (node, nextSiblingNode) => {
          if (!isElementRef(node)) return;

          let nextEl: TElement | null = null;

          if (nextSiblingNode && isElementRef(nextSiblingNode)) {
            nextEl = nextSiblingNode.element;
          } else if (!nextSiblingNode) {
            nextEl = resolveNextRef(nextSibling)?.element ?? null;
          }

          renderer.insertBefore(parentEl, node.element, nextEl);
        },

        // onRemove: called when item is being removed
        onRemove: (key, node) => {
          // Dispose the row's scope (automatically disposes child element scope via hierarchy)
          const entry = itemData.get(key);
          if (entry) disposeScope(entry.scope);

          // Clean up itemData
          itemData.delete(key);

          // Remove from DOM and clean up element scope registration
          if (!isElementRef(node)) return;
          ctx.elementScopes.delete(node.element);
          renderer.removeChild(parentEl, node.element);
        },
      });

      // Create effect within parent's scope - auto-tracked!
      const effectDispose = scopedEffect(() => {
        // Reconcile with just items and key function
        reconcile(
          items(),
          (item) => keyFn ? keyFn(item) : item as string | number
        );
      });

      // Return cleanup function
      return () => {
        // Dispose the effect
        effectDispose();

        // Dispose all remaining items via reconciler
        // This calls onRemove hook for each tracked item
        dispose();

        // Clear remaining data
        itemData.clear();
      };
    });
  }

  return map;
}
