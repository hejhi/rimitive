/**
 * Instrumentation wrapper for map primitive
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { MapFactory } from '../map';
import type { RefSpec, SealedSpec, FragmentRef, Reactive } from '../types';
import { STATUS_REF_SPEC } from '../types';

/**
 * Instrument a map factory to emit events
 */
export function instrumentMap<TBaseElement>(
  method: MapFactory<TBaseElement>['method'],
  instrumentation: InstrumentationContext
): MapFactory<TBaseElement>['method'] {
  type TSpec = RefSpec<TBaseElement> | SealedSpec<TBaseElement>;

  function instrumentedMap<T>(
    items: T[] | (() => T[]) | Reactive<T[]>,
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

    // Call base method - TypeScript overloads will resolve at call site
    const renderApplicator = method(items as () => T[], keyFn);

    // Wrap the render applicator
    return (render: (itemSignal: Reactive<T>) => TSpec): RefSpec<TBaseElement> => {
      instrumentation.emit({
        type: 'MAP_RENDER_ATTACHED',
        timestamp: Date.now(),
        data: {
          mapId,
        },
      });

      // Track reconciliation operations by wrapping the render function
      const instrumentedRender = (itemSignal: Reactive<T>): TSpec => {
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

      const instrumentedRefSpec: RefSpec<TBaseElement> = (...callbacks) => {
        refSpec(...callbacks);
        return instrumentedRefSpec;
      };

      instrumentedRefSpec.status = STATUS_REF_SPEC;
      instrumentedRefSpec.create = (api, extensions) => {
        const fragmentRef = originalCreate(api, extensions) as FragmentRef<TBaseElement>;

        // Wrap attach to track mount and reconciliation
        const originalAttach = fragmentRef.attach.bind(fragmentRef);

        fragmentRef.attach = (parent, nextSibling, attachApi) => {
          instrumentation.emit({
            type: 'MAP_MOUNTED',
            timestamp: Date.now(),
            data: {
              mapId,
            },
          });

          return originalAttach(parent, nextSibling, attachApi);
        };

        return fragmentRef;
      };

      return instrumentedRefSpec;
    };
  }

  return instrumentedMap;
}
