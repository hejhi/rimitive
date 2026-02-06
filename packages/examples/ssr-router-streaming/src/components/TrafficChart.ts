/**
 * TrafficChart Component
 *
 * Text-based hourly traffic visualization for site detail pages.
 * Renders a horizontal bar chart showing visitor counts per hour.
 */
import type { TrafficPoint } from '../data/types.js';
import type { Service } from '../service.js';

export type TrafficChartProps = {
  points: TrafficPoint[];
  color: string;
};

export const TrafficChart =
  ({ el }: Service) =>
  (props: TrafficChartProps) => {
    const div = el('div');
    const span = el('span');
    const h3 = el('h3');
    const section = el('section');

    // Show every other hour (even indices) to keep it compact
    const filtered = props.points.filter((_, i) => i % 2 === 0);
    const maxVisitors = Math.max(...filtered.map((p) => p.visitors), 1);

    const row = (point: TrafficPoint) => {
      const widthPercent = (point.visitors / maxVisitors) * 100;

      return div.props({ className: 'chart-row' })(
        span.props({ className: 'chart-label' })(point.hour),
        span.props({
          className: 'chart-bar',
          style: `width: ${widthPercent}%; background-color: ${props.color}`,
        })(),
        span.props({ className: 'chart-value' })(
          point.visitors.toLocaleString()
        )
      );
    };

    return section.props({ className: 'traffic-chart' })(
      h3.props({})('Traffic (24h)'),
      ...filtered.map(row)
    );
  };
