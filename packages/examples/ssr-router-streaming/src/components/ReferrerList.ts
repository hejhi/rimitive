/**
 * ReferrerList Component
 *
 * Referrer breakdown list with trend indicators.
 */
import type { Referrer } from '../data/types.js';
import type { Service } from '../service.js';

export type ReferrerListProps = {
  referrers: Referrer[];
};

const TREND_ARROWS: Record<Referrer['trend'], string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

export const ReferrerList =
  ({ el }: Service) =>
  (props: ReferrerListProps) => {
    const div = el('div');
    const span = el('span');
    const h3 = el('h3');
    const section = el('section');

    const item = (referrer: Referrer) =>
      div.props({ className: 'referrer-item' })(
        span.props({ className: 'referrer-source' })(referrer.source),
        span.props({ className: 'referrer-visitors' })(
          referrer.visitors.toLocaleString()
        ),
        span.props({ className: `referrer-trend trend-${referrer.trend}` })(
          TREND_ARROWS[referrer.trend]
        )
      );

    return section.props({ className: 'referrer-list' })(
      h3.props({})('Referrers'),
      ...props.referrers.map(item)
    );
  };
