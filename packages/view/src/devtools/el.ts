/**
 * Instrumentation wrapper for el primitive
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { ElFactory, ChildrenApplicator, ElementProps } from '../el';
import type { RefSpec, ElRefSpecChild } from '../types';
import type { RendererConfig } from '../renderer';

/**
 * Instrument an el factory to emit events
 */
export function instrumentEl<TConfig extends RendererConfig>(
  method: ElFactory<TConfig>['method'],
  instrumentation: InstrumentationContext
): ElFactory<TConfig>['method'] {
  // Static element instrumentation matching ElFactory signature
  function instrumentedEl<Tag extends string & keyof TConfig['elements']>(
    tag: Tag,
    props?: ElementProps<TConfig, Tag>
  ): ChildrenApplicator<TConfig, Tag> {
    const elId = crypto.randomUUID();

    instrumentation.emit({
      type: 'EL_STATIC_CREATED',
      timestamp: Date.now(),
      data: {
        elId,
        tag,
        propsCount: props ? Object.keys(props).length : 0,
      },
    });

    // Call base method to get children applicator
    const childrenApplicator = method(tag, props);

    // Wrap the children applicator to intercept RefSpec creation
    return (...children: ElRefSpecChild[]): RefSpec<TConfig['elements'][Tag]> => {
      instrumentation.emit({
        type: 'EL_CHILDREN_APPLIED',
        timestamp: Date.now(),
        data: {
          elId,
          childCount: children.length,
        },
      });

      // Call the original children applicator to get RefSpec
      const refSpec = childrenApplicator(...children);

      // Wrap the create method to emit mount/unmount events
      const originalCreate = refSpec.create.bind(refSpec);
      refSpec.create = <TExt>(api?: unknown, extensions?: TExt) => {
        instrumentation.emit({
          type: 'EL_STATIC_MOUNTED',
          timestamp: Date.now(),
          data: {
            elId,
            tag,
          },
        });

        const elementRef = originalCreate(api, extensions);

        // Track lifecycle callbacks count
        instrumentation.emit({
          type: 'EL_STATIC_READY',
          timestamp: Date.now(),
          data: {
            elId,
          },
        });

        return elementRef;
      };

      return refSpec;
    };
  }

  return instrumentedEl;
}
