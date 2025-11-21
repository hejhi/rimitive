/**
 * TagList - Fragment component that returns multiple elements without a root wrapper
 *
 * This demonstrates that components can return fragments directly using map()
 */
import { useSvc } from '../service';

export const TagList = useSvc((api) => {
  return (props: { tags: string[] }) => {
    const { el, map, signal } = api;
    const tags = signal(props.tags);

    // Return fragment - multiple span elements without a wrapper
    // map() returns a RefSpec that creates a FragmentRef when instantiated
    return map(tags)((tag) => {
      return el('span', {
        className: 'tag',
        onclick: () => {
          // Remove this tag when clicked
          const current = tags();
          tags(current.filter((t) => t !== tag()));
        },
      })(`${tag()} x`);
    });
  };
});
