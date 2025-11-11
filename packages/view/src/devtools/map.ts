/**
 * Instrumentation wrapper for map primitive
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { MapFactory } from '../map';
import type { RefSpec, SealedSpec, FragmentRef, Reactive } from '../types';
import type { Element as RendererElement } from '../renderer';

/**
 * Instrument a map factory to emit events
 */
export function instrumentMap<TElement extends RendererElement>(
  method: MapFactory<TElement>['method'],
  instrumentation: InstrumentationContext
): MapFactory<TElement>['method'] {
  return function instrumentedMap<T>(
    items: () => T[],
    keyFn?: (item: T) => string | number
  ): (render: (itemSignal: Reactive<T>) => RefSpec<TElement> | SealedSpec<TElement>) => FragmentRef<TElement> {
    const mapId = crypto.randomUUID();

    instrumentation.emit({
      type: 'MAP_CREATED',
      timestamp: Date.now(),
      data: {
        mapId,
        hasKeyFn: !!keyFn,
      },
    });

    // Call base method to get render function applicator
    const renderApplicator = method(items, keyFn);

    // Wrap the render applicator
    return (render: (itemSignal: Reactive<T>) => RefSpec<TElement> | SealedSpec<TElement>): FragmentRef<TElement> => {
      instrumentation.emit({
        type: 'MAP_RENDER_ATTACHED',
        timestamp: Date.now(),
        data: {
          mapId,
        },
      });

      // Track reconciliation operations by wrapping the render function
      const instrumentedRender = (itemSignal: Reactive<T>): RefSpec<TElement> | SealedSpec<TElement> => {
        const itemId = crypto.randomUUID();

        instrumentation.emit({
          type: 'MAP_ITEM_RENDER',
          timestamp: Date.now(),
          data: {
            mapId,
            itemId,
          },
        });

        return render(itemSignal);
      };

      // Call base render applicator with instrumented render
      const fragmentRef = renderApplicator(instrumentedRender);

      // Wrap attach to track mount and reconciliation
      const originalAttach = fragmentRef.attach;

      fragmentRef.attach = (parent, nextSibling, api) => {
        instrumentation.emit({
          type: 'MAP_MOUNTED',
          timestamp: Date.now(),
          data: {
            mapId,
          },
        });

        const result = originalAttach.call(fragmentRef, parent, nextSibling, api);

        // Wrap dispose to emit unmount event
        if (result.dispose) {
          const originalDispose = result.dispose;
          result.dispose = () => {
            instrumentation.emit({
              type: 'MAP_UNMOUNTED',
              timestamp: Date.now(),
              data: {
                mapId,
              },
            });
            originalDispose();
          };
        }

        return result;
      };

      return fragmentRef;
    };
  };
}
