/**
 * Batched Updates View Component
 *
 * Demonstrates batched updates - multiple state changes in a single render cycle.
 * Uses the create() pattern.
 */

import { create } from '../create';
import type { RefSpec } from '@lattice/view/types';

interface BatchedUpdateHandlers {
  onBatchedUpdate: () => void;
}

export const BatchedUpdates = create(
  ({ el, on }) =>
    ({ onBatchedUpdate }: BatchedUpdateHandlers): RefSpec<HTMLElement> => {
      const batchBtn = el('button')('Run Batched Updates')(
        on('click', onBatchedUpdate)
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
