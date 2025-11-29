/**
 * TagList Island - Fragment island that returns multiple elements without a root wrapper
 *
 * This tests fragment island hydration using map() to return multiple siblings
 */
import { island } from '@lattice/islands/island';
import type { Service } from '../service.js';

type TagListProps = { tags: string[] };

export const TagList = island<TagListProps, Service>(
  'taglist',
  ({ el, map, signal }) =>
    (props) => {
      const tags = signal(props.tags);

      // Return fragment - multiple span elements without a wrapper
      // map() takes items and optional keyFn, then returns a function that takes render callback
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
    }
);
