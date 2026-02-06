import type { PageService } from '../pages';

export type EmptyStateProps = {
  visible: () => boolean;
  message: string;
  hint?: string;
};

export const EmptyState = (svc: PageService) => {
  const { el } = svc;
  const div = el('div');
  const span = el('span');

  return (props: EmptyStateProps) => {
    const { visible, message, hint } = props;

    return div.props({
      className: () => (visible() ? 'empty-state' : 'empty-state hidden'),
      style: () => (visible() ? '' : 'display: none'),
    })(
      span(message),
      hint ? span.props({ className: 'hint' })(hint) : null
    );
  };
};
