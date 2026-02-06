import type { Readable } from '@rimitive/signals';
import type { PageService } from '../pages';

const COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
] as const;

export type NewListFormProps = {
  visible: Readable<boolean>;
  onCreate: (name: string, color: string) => void;
};

export const NewListForm = (svc: PageService) => {
  const { el, signal } = svc;
  const div = el('div');
  const button = el('button');
  const input = el('input');

  return (props: NewListFormProps) => {
    const { visible, onCreate } = props;
    const name = signal('');
    const selectedColor = signal<string>(COLORS[0]);

    const handleCreate = () => {
      const trimmed = name().trim();
      if (trimmed) {
        onCreate(trimmed, selectedColor());
        name('');
      }
    };

    return div.props({
      className: () => `new-list-form ${visible() ? 'visible' : ''}`,
    })(
      input.props({
        type: 'text',
        placeholder: 'List name...',
        value: name,
        oninput: (e: Event) => name((e.target as HTMLInputElement).value),
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') handleCreate();
        },
      })(),
      div.props({ className: 'color-picker' })(
        ...COLORS.map((color) =>
          button.props({
            className: () =>
              `color-btn ${selectedColor() === color ? 'selected' : ''}`,
            style: `background: ${color}`,
            onclick: () => selectedColor(color),
          })()
        )
      ),
      button.props({ className: 'create-btn', onclick: handleCreate })('Create')
    );
  };
};
