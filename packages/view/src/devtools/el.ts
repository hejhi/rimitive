/**
 * Instrumentation wrapper for el primitive
 */

import type { InstrumentationContext } from '@rimitive/core';
import type { ElFactory, TagFactory, ElementProps } from '../el';
import type { RefSpec, ElRefSpecChild } from '../types';
import type { TreeConfig } from '../adapter';

/**
 * Instrument an el factory to emit events
 */
export function instrumentEl<TConfig extends TreeConfig>(
  impl: ElFactory<TConfig>,
  instrumentation: InstrumentationContext
): ElFactory<TConfig> {
  // Static element instrumentation matching ElFactory signature
  function instrumentedEl<Tag extends string & keyof TConfig['nodes']>(
    tag: Tag
  ): TagFactory<TConfig, Tag> {
    const elId = crypto.randomUUID();

    instrumentation.emit({
      type: 'EL_STATIC_CREATED',
      timestamp: Date.now(),
      data: {
        elId,
        tag,
        propsCount: 0,
      },
    });

    // Call base impl to get tag factory
    const tagFactory = impl(tag);

    // Wrap the tag factory to intercept props and children
    const wrappedFactory = (
      ...children: ElRefSpecChild[]
    ): RefSpec<TConfig['nodes'][Tag]> => {
      instrumentation.emit({
        type: 'EL_CHILDREN_APPLIED',
        timestamp: Date.now(),
        data: {
          elId,
          childCount: children.length,
        },
      });

      // Call the original tag factory to get RefSpec
      const refSpec = tagFactory(...children);

      // Wrap the create method to emit mount/unmount events
      const originalCreate = refSpec.create.bind(refSpec);
      refSpec.create = <TExt>(svc?: unknown, extensions?: TExt) => {
        instrumentation.emit({
          type: 'EL_STATIC_MOUNTED',
          timestamp: Date.now(),
          data: {
            elId,
            tag,
          },
        });

        const elementRef = originalCreate(svc, extensions);

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

    // Wrap the props method to track props being added
    wrappedFactory.props = (
      propsOrFn:
        | ElementProps<TConfig, Tag>
        | ((current: ElementProps<TConfig, Tag>) => ElementProps<TConfig, Tag>)
    ): TagFactory<TConfig, Tag> => {
      const props =
        typeof propsOrFn === 'function'
          ? propsOrFn({} as ElementProps<TConfig, Tag>)
          : propsOrFn;

      instrumentation.emit({
        type: 'EL_STATIC_CREATED',
        timestamp: Date.now(),
        data: {
          elId,
          tag,
          propsCount: props ? Object.keys(props).length : 0,
        },
      });

      // Call original props method and wrap the result
      tagFactory.props(propsOrFn);
      return instrumentedEl(tag) as TagFactory<TConfig, Tag>;
    };

    return wrappedFactory as TagFactory<TConfig, Tag>;
  }

  return instrumentedEl;
}
