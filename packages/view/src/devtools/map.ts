/**
 * Instrumentation wrapper for map primitive
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { MapFactory } from '../map';
import type { RefSpec, SealedSpec, FragmentRef, Reactive } from '../types';
import type { RendererConfig } from '../renderer';

/**
 * Instrument a map factory to emit events
 */
export function instrumentMap<TConfig extends RendererConfig>(
  method: MapFactory<TConfig>['method'],
  instrumentation: InstrumentationContext
): MapFactory<TConfig>['method'] {
  return function instrumentedMap<T>(
    items: () => T[],
    keyFn?: (item: T) => string | number
  ): (render: (itemSignal: Reactive<T>) => RefSpec<TConfig['baseElement']> | SealedSpec<TConfig['baseElement']>) => FragmentRef<TConfig['baseElement']> {
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
    return (render: (itemSignal: Reactive<T>) => RefSpec<TConfig['baseElement']> | SealedSpec<TConfig['baseElement']>): FragmentRef<TConfig['baseElement']> => {
      instrumentation.emit({
        type: 'MAP_RENDER_ATTACHED',
        timestamp: Date.now(),
        data: {
          mapId,
        },
      });

      // Track reconciliation operations by wrapping the render function
      const instrumentedRender = (itemSignal: Reactive<T>): RefSpec<TConfig['baseElement']> | SealedSpec<TConfig['baseElement']> => {
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

        return originalAttach.call(fragmentRef, parent, nextSibling, api);
      };

      return fragmentRef;
    };
  };
}
