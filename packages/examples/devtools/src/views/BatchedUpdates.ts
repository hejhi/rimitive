/**
 * Batched Updates View Component
 *
 * Demonstrates batched updates - multiple state changes in a single render cycle.
 * Uses the create() pattern.
 */

import { useSvc } from '../service';

interface BatchedUpdateHandlers {
  onBatchedUpdate: () => void;
}

export const BatchedUpdates = useSvc(
  ({ el, addEventListener }) =>
    ({ onBatchedUpdate }: BatchedUpdateHandlers) => {
      const batchBtn = el('button')('Run Batched Updates')(
        addEventListener('click', onBatchedUpdate)
      );

      return el('section', { className: 'batched-section' })(
        el('h2')('Batched Updates Example'),
        el('p')(
          'This button demonstrates batched updates - multiple state changes in one render'
        ),
        batchBtn
      );
    }
);
