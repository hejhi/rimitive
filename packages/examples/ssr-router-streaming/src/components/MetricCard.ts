/**
 * MetricCard Component
 *
 * Displays a single metric with its label and change indicator.
 */
import type { Service } from '../service.js';

export type MetricCardProps = {
  label: string;
  value: string;
  change: number;
};

export const MetricCard =
  ({ el }: Service) =>
  (props: MetricCardProps) => {
    const { label, value, change } = props;
    const div = el('div');
    const span = el('span');

    const sign = change >= 0 ? '+' : '';
    const direction = change >= 0 ? 'up' : 'down';
    const formatted = `${sign}${change.toFixed(1)}%`;

    return div.props({ className: 'metric-card' })(
      span.props({ className: 'metric-value' })(value),
      span.props({ className: 'metric-label' })(label),
      span.props({ className: `metric-change ${direction}` })(formatted)
    );
  };
