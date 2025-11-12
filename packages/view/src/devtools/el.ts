/**
 * Instrumentation wrapper for el primitive
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { ElFactory, ChildrenApplicator, ElementProps } from '../el';
import type { RefSpec, ElRefSpecChild, Reactive } from '../types';
import type { RendererConfig } from '../renderer';

/**
 * Instrument an el factory to emit events
 */
export function instrumentEl<TConfig extends RendererConfig>(
  method: ElFactory<TConfig>['method'],
  instrumentation: InstrumentationContext
): ElFactory<TConfig>['method'] {
  // Overloaded implementation matching ElFactory signature
  function instrumentedEl<Tag extends string & keyof TConfig['elements']>(
    tag: Tag,
    props?: ElementProps<TConfig, Tag>
  ): ChildrenApplicator<TConfig, Tag>;
  function instrumentedEl<Tag extends keyof TConfig['elements']>(
    reactive: Reactive<Tag | null>,
    props?: ElementProps<TConfig, Tag>
  ): (...children: ElRefSpecChild[]) => RefSpec<TConfig['elements'][Tag]>;
  function instrumentedEl<Tag extends string & keyof TConfig['elements']>(
    tagOrReactive: Tag | Reactive<Tag | null>,
    props?: ElementProps<TConfig, Tag>
  ): ChildrenApplicator<TConfig, Tag> | ((...children: ElRefSpecChild[]) => RefSpec<TConfig['elements'][Tag]>) {
    // Handle reactive element case
    if (typeof tagOrReactive === 'function') {
      const elId = crypto.randomUUID();

      instrumentation.emit({
        type: 'EL_REACTIVE_CREATED',
        timestamp: Date.now(),
        data: {
          elId,
          isReactive: true,
        },
      });

      // Create the reactive element through base method - returns ChildrenApplicator
      const childrenApplicator = method(tagOrReactive, props);

      // Wrap the children applicator to track mounting
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

        // Wrap the create method to emit mount event
        const originalCreate = refSpec.create.bind(refSpec);
        refSpec.create = <TExt>(api?: unknown, extensions?: TExt) => {
          instrumentation.emit({
            type: 'EL_REACTIVE_MOUNTED',
            timestamp: Date.now(),
            data: {
              elId,
            },
          });

          return originalCreate(api, extensions);
        };

        return refSpec;
      };
    }

    // Handle static element case
    const tag = tagOrReactive;
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
