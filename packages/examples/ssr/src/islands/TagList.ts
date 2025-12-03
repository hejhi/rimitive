/**
 * TagList Island - Fragment island that returns multiple elements without a root wrapper
 *
 * This tests fragment island hydration using map() to return multiple siblings
 */
import { island } from '../service.js';

export const TagList = island(
  'taglist',
  ({ el, map, signal }) =>
    ({ tags: initialTags }: { tags: string[] }) => {
      const tags = signal(initialTags);

      // Return fragment - multiple span elements without a wrapper
      // map() takes items and optional keyFn, then render callback
      return map(tags, (tagSignal) => {
        const tag = tagSignal();
        return el('span').props({
          className: 'tag',
          onclick: () => {
            // Remove this tag when clicked
            const current = tags();
            tags(current.filter((t) => t !== tag));
          },
        })(`${tag} x`);
      });
    }
);
