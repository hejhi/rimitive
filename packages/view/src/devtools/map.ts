/**
 * Instrumentation wrapper for map primitive
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { MapFactory } from '../map';
import type { RefSpec, FragmentRef, Reactive } from '../types';
import { STATUS_REF_SPEC } from '../types';

/**
 * Instrument a map factory to emit events
 */
export function instrumentMap<TBaseElement>(
  impl: MapFactory<TBaseElement>['impl'],
  instrumentation: InstrumentationContext
): MapFactory<TBaseElement>['impl'] {
  function instrumentedMap<T, TEl>(
    items: T[] | Reactive<T[]>,
    keyFn?: (item: T) => string | number
  ) {
    const mapId = crypto.randomUUID();

    instrumentation.emit({
      type: 'MAP_CREATED',
      timestamp: Date.now(),
      data: {
        mapId,
        hasKeyFn: !!keyFn,
      },
    });

    // Call base impl
    const renderApplicator = impl<T, TEl>(items, keyFn);

    // Wrap the render applicator
    return (render: (itemSignal: Reactive<T>) => RefSpec<TEl>): RefSpec<TBaseElement> => {
      instrumentation.emit({
        type: 'MAP_RENDER_ATTACHED',
        timestamp: Date.now(),
        data: {
          mapId,
        },
      });

      // Track reconciliation operations by wrapping the render function
      const instrumentedRender = (itemSignal: Reactive<T>): RefSpec<TEl> => {
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
      const refSpec = renderApplicator(instrumentedRender);

      // Wrap create to instrument the fragment ref creation
      const originalCreate = refSpec.create.bind(refSpec);

      const instrumentedRefSpec: RefSpec<TBaseElement> = {
        status: STATUS_REF_SPEC,
        create: (api, extensions) => {
          const fragmentRef = originalCreate(
            api,
            extensions
          ) as FragmentRef<TBaseElement>;

          // TODO: Add instrumentation for fragment initialization
          // (fragments no longer have attach() - initialized in processChildren)
          instrumentation.emit({
            type: 'MAP_MOUNTED',
            timestamp: Date.now(),
            data: {
              mapId,
            },
          });

          return fragmentRef;
        },
      };

      return instrumentedRefSpec;
    };
  }

  return instrumentedMap;
}
