/**
 * TagList - Fragment component that returns multiple elements without a root wrapper
 *
 * This demonstrates that components can return fragments directly using map()
 */
import { el, map, signal, computed } from '../service';

export const TagList = (props: { tags: string[] }) => {
  const tags = signal(props.tags);

  // Return fragment - multiple span elements without a wrapper
  // map() returns a RefSpec that creates a FragmentRef when instantiated
  // Render callback receives a signal wrapping each tag
  return map(tags)((tagSignal) => {
    // Read initial value for the click handler
    const tag = tagSignal();

    return el('span').props({
      className: 'tag',
      onclick: () => {
        // Remove this tag when clicked
        const current = tags();
        tags(current.filter((t) => t !== tag));
      },
    })(computed(() => `${tagSignal()} x`));
  });
};
