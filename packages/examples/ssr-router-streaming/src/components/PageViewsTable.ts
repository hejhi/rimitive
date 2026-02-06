/**
 * PageViewsTable Component
 *
 * Table displaying top pages with their view counts and unique visitors.
 */
import type { TopPage } from '../data/types.js';
import type { Service } from '../service.js';

export type PageViewsTableProps = {
  pages: TopPage[];
};

export const PageViewsTable =
  ({ el }: Service) =>
  (props: PageViewsTableProps) => {
    const div = el('div');
    const span = el('span');
    const h3 = el('h3');
    const section = el('section');

    const row = (page: TopPage) =>
      div.props({ className: 'pageviews-row' })(
        span.props({ className: 'page-path' })(page.path),
        span.props({ className: 'page-views' })(
          page.views.toLocaleString()
        ),
        span.props({ className: 'page-visitors' })(
          page.uniqueVisitors.toLocaleString()
        )
      );

    return section.props({ className: 'pageviews-table' })(
      h3.props({})('Top Pages'),
      ...props.pages.map(row)
    );
  };
