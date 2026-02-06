/**
 * EventFilter Component
 *
 * Interactive filter buttons for event types.
 * This is the primary interactive island — it's reactive after hydration.
 */
import type { Readable } from '@rimitive/signals';
import type { AnalyticsEvent } from '../data/types.js';
import type { Service } from '../service.js';

export type EventFilterProps = {
  events: Readable<AnalyticsEvent[]>;
  activeFilter: Readable<string>;
  onFilter: (type: string) => void;
};

const EVENT_TYPES = ['all', 'pageview', 'signup', 'purchase', 'error'] as const;

export const EventFilter =
  ({ el, computed }: Service) =>
  (props: EventFilterProps) => {
    const { events, activeFilter, onFilter } = props;
    const div = el('div');
    const button = el('button');
    const span = el('span');

    const filterButtons = EVENT_TYPES.map((type) =>
      button.props({
        className: computed(() =>
          activeFilter() === type ? 'filter-btn active' : 'filter-btn'
        ),
        onclick: () => onFilter(type),
      })(type)
    );

    const count = computed(() => {
      const all = events();
      const filter = activeFilter();
      const shown = filter === 'all' ? all.length : all.filter((e) => e.type === filter).length;
      return `Showing ${shown} of ${all.length} events`;
    });

    return div.props({ className: 'event-filter' })(
      div.props({ className: 'filter-buttons' })(...filterButtons),
      span.props({ className: 'filter-count' })(count)
    );
  };
