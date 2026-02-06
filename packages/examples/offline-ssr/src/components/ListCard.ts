import type { PageService } from '../pages';
import type { TodoListWithStats } from '../data';

export type ListCardProps = {
  list: TodoListWithStats;
  onNavigate: (route: string) => void;
  onDelete: (id: string) => void;
};

export const ListCard = (svc: PageService) => {
  const { el } = svc;
  const div = el('div');
  const span = el('span');
  const button = el('button');

  return (props: ListCardProps) => {
    const { list, onNavigate, onDelete } = props;
    const progress =
      list.itemCount > 0 ? (list.completedCount / list.itemCount) * 100 : 0;

    const handleDelete = (e: Event) => {
      e.stopPropagation();
      if (confirm('Delete this list and all its items?')) {
        onDelete(list.id);
      }
    };

    return div.props({
      className: 'list-card',
      style: `border-left-color: ${list.color}`,
      onclick: () => onNavigate(`/list/${list.id}`),
    })(
      div.props({ className: 'list-card-content' })(
        div.props({ className: 'list-card-header' })(
          span.props({ className: 'list-name' })(list.name),
          span.props({ className: 'list-count' })(
            `${list.completedCount}/${list.itemCount}`
          )
        ),
        div.props({ className: 'list-progress-bar' })(
          div.props({
            className: 'list-progress-fill',
            style: `width: ${progress}%; background: ${list.color}`,
          })()
        ),
        list.preview.length > 0
          ? div.props({ className: 'list-preview' })(
              ...list.preview.map((text) =>
                span.props({ className: 'list-preview-item' })(text)
              )
            )
          : null
      ),
      button.props({
        className: 'delete-btn',
        onclick: handleDelete,
      })('×')
    );
  };
};
