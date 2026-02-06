import type { Readable } from '@rimitive/signals';
import type { PageService } from '../pages';
import type { TodoItem as TodoItemType } from '../data';

export type TodoItemProps = {
  item: Readable<TodoItemType>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export const TodoItem = (svc: PageService) => {
  const { el } = svc;
  const div = el('div');
  const span = el('span');
  const button = el('button');
  const input = el('input');
  const label = el('label');

  return (props: TodoItemProps) => {
    const { item, onToggle, onDelete } = props;

    const handleDelete = (e: Event) => {
      e.stopPropagation();
      onDelete(item().id);
    };

    return div.props({
      className: () => `item ${item().completed ? 'completed' : ''}`,
    })(
      label.props({ className: 'item-checkbox' })(
        input.props({
          type: 'checkbox',
          checked: () => item().completed,
          onchange: () => onToggle(item().id),
        })(),
        span.props({ className: 'checkmark' })()
      ),
      span.props({ className: 'item-text' })(() => item().text),
      button.props({
        className: 'delete-item-btn',
        onclick: handleDelete,
      })('×')
    );
  };
};
