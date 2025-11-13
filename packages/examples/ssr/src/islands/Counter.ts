/**
 * Counter Island - Interactive component that ships JS to client
 */
import { create } from '@lattice/view/component';
import { island } from '@lattice/data/island';

console.log('[Counter.ts] Defining Counter island...');

export const Counter = island(
  'counter',
  create((api) => {
    console.log('[Counter] create() outer function called');
    return (props: { initialCount: number }) => {
      console.log('[Counter] factory function called with props:', props);
      console.log('[Counter] api keys:', Object.keys(api).join(', '));
      const { el, signal } = api;
      console.log('[Counter] creating signal...');
      const count = signal(props.initialCount);
      console.log('[Counter] signal created, building DOM...');

      console.log('[Counter] creating simple div...');
      const result = el('div')(`Count: ${count()}`)();
      console.log('[Counter] div created successfully');
      return result;
    };
  })
);

console.log('[Counter.ts] Counter island defined');
