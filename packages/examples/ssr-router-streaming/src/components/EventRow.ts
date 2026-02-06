/**
 * EventRow Component
 *
 * Single event row for the feed page.
 */
import type { AnalyticsEvent } from '../data/types.js';
import type { Service } from '../service.js';

export type EventRowProps = {
  event: AnalyticsEvent;
};

export const EventRow =
  ({ el }: Service) =>
  (props: EventRowProps) => {
    const { event } = props;
    const div = el('div');
    const span = el('span');

    return div.props({ className: 'event-row' })(
      span.props({ className: `event-type event-type-${event.type}` })(
        event.type
      ),
      span.props({ className: 'event-path' })(event.path),
      span.props({ className: 'event-visitor' })(event.visitor),
      span.props({ className: 'event-time' })(event.timestamp)
    );
  };
