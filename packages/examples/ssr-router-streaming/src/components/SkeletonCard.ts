/**
 * SkeletonCard Component
 *
 * Generic loading skeleton used across pages for consistent loading states.
 */
import type { Service } from '../service.js';

export type SkeletonCardProps = {
  /** Height hint: 'sm' (single line), 'md' (card), 'lg' (table/list) */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label shown in skeleton */
  label?: string;
};

export const SkeletonCard =
  ({ el }: Service) =>
  (props: SkeletonCardProps = {}) => {
    const { size = 'md', label = 'Loading...' } = props;
    return el('div').props({ className: `skeleton skeleton-${size}` })(
      el('span').props({ className: 'skeleton-text' })(label)
    );
  };
