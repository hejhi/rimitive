/**
 * Batched Updates View Component
 *
 * Demonstrates batched updates - multiple state changes in a single render cycle.
 */
import type { Service } from '../service';

type BatchedUpdatesProps = {
  onBatchedUpdate: () => void;
};

export const BatchedUpdates =
  (svc: Service) =>
  ({ onBatchedUpdate }: BatchedUpdatesProps) => {
    const { el } = svc;

    const batchBtn = el('button').props({ onclick: onBatchedUpdate })(
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
