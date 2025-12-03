/**
 * Batched Updates View Component
 *
 * Demonstrates batched updates - multiple state changes in a single render cycle.
 */
import { el, on } from '../service';

interface BatchedUpdateHandlers {
  onBatchedUpdate: () => void;
}

export const BatchedUpdates = ({ onBatchedUpdate }: BatchedUpdateHandlers) => {
  const batchBtn = el('button').ref(on('click', onBatchedUpdate))(
    'Run Batched Updates'
  );

  return el('section').props({ className: 'batched-section' })(
    el('h2')('Batched Updates Example'),
    el('p')(
      'This button demonstrates batched updates - multiple state changes in one render'
    ),
    batchBtn
  );
};
