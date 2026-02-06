import type { PageService } from '../pages';

export type AddItemFormProps = {
  color: string;
  onAdd: (text: string) => void;
};

export const AddItemForm = (svc: PageService) => {
  const { el, signal } = svc;
  const div = el('div');
  const button = el('button');
  const input = el('input');

  return (props: AddItemFormProps) => {
    const { color, onAdd } = props;
    const text = signal('');

    const handleAdd = () => {
      const trimmed = text().trim();
      if (trimmed) {
        onAdd(trimmed);
        text('');
      }
    };

    return div.props({ className: 'add-item-form' })(
      input.props({
        type: 'text',
        placeholder: 'Add a todo...',
        value: text,
        oninput: (e: Event) => text((e.target as HTMLInputElement).value),
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') handleAdd();
        },
      })(),
      button.props({
        className: 'add-item-btn',
        onclick: handleAdd,
        style: `background: ${color}`,
      })('Add')
    );
  };
};
