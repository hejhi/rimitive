/**
 * Instrumentation wrapper for el primitive
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { ElFactory, ChildrenApplicator, ReactiveElSpec, ElementProps } from '../el';
import type { RefSpec, FragmentRef, ElRefSpecChild, Reactive } from '../types';
import type { Element as RendererElement } from '../renderer';

/**
 * Instrument an el factory to emit events
 */
export function instrumentEl<TElement extends RendererElement>(
  method: ElFactory<TElement>['method'],
  instrumentation: InstrumentationContext
): ElFactory<TElement>['method'] {
  // Overloaded implementation matching ElFactory signature
  function instrumentedEl<Tag extends keyof HTMLElementTagNameMap>(
    tag: Tag,
    props?: ElementProps<Tag>
  ): ChildrenApplicator<Tag>;
  function instrumentedEl<Tag extends keyof HTMLElementTagNameMap>(
    reactive: Reactive<ReactiveElSpec<Tag>>
  ): FragmentRef<TElement>;
  function instrumentedEl<Tag extends keyof HTMLElementTagNameMap>(
    tagOrReactive: Tag | Reactive<ReactiveElSpec<Tag>>,
    props?: ElementProps<Tag>
  ): ChildrenApplicator<Tag> | FragmentRef<TElement> {
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

      // Create the reactive element through base method
      const fragmentRef = method(tagOrReactive);

      // Wrap attach to emit mount event
      const originalAttach = fragmentRef.attach;
      fragmentRef.attach = (parent, nextSibling, api) => {
        instrumentation.emit({
          type: 'EL_REACTIVE_MOUNTED',
          timestamp: Date.now(),
          data: {
            elId,
          },
        });

        const result = originalAttach.call(fragmentRef, parent, nextSibling, api);

        // Wrap dispose to emit unmount event
        if (result.dispose) {
          const originalDispose = result.dispose;
          result.dispose = () => {
            instrumentation.emit({
              type: 'EL_REACTIVE_UNMOUNTED',
              timestamp: Date.now(),
              data: {
                elId,
              },
            });
            originalDispose();
          };
        }

        return result;
      };

      return fragmentRef;
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
    return (...children: ElRefSpecChild[]): RefSpec<HTMLElementTagNameMap[Tag]> => {
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
