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
    keyFnOrRender:
      | ((item: T) => string | number)
      | ((itemSignal: Reactive<T>) => RefSpec<TEl>),
    maybeRender?: (itemSignal: Reactive<T>) => RefSpec<TEl>
  ): RefSpec<TBaseElement> {
    const mapId = crypto.randomUUID();

    // Determine which overload was used
    const hasKeyFn = !!maybeRender;
    const render = maybeRender
      ? maybeRender
      : (keyFnOrRender as (itemSignal: Reactive<T>) => RefSpec<TEl>);

    instrumentation.emit({
      type: 'MAP_CREATED',
      timestamp: Date.now(),
      data: {
        mapId,
        hasKeyFn,
      },
    });

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

    // Call base impl with instrumented render
    const refSpec = maybeRender
      ? impl<T, TEl>(
          items,
          keyFnOrRender as (item: T) => string | number,
          instrumentedRender
        )
      : impl<T, TEl>(items, instrumentedRender);

    // Wrap create to instrument the fragment ref creation
    const originalCreate = refSpec.create.bind(refSpec);

    const instrumentedRefSpec: RefSpec<TBaseElement> = {
      status: STATUS_REF_SPEC,
      create: (svc, extensions) => {
        const fragmentRef = originalCreate(
          svc,
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
  }

  return instrumentedMap;
}
