import { svc, type Service } from './svc.ts';

const App =
  ({ signal, el, map }: Service) =>
  () => {
    const items = signal([
      { id: 1, text: 'Apple' },
      { id: 2, text: 'Banana' },
      { id: 3, text: 'Cherry' },
    ]);
    let nextId = 4;

    const add = () => {
      items([...items(), { id: nextId++, text: `Item ${nextId - 1}` }]);
    };

    const remove = (id: number) => {
      items(items().filter((item) => item.id !== id));
    };

    return el('div').props({ style: 'font-family: system-ui; padding: 16px;' })(
      el('h3')('Rendering Lists with map()'),

      el('button').props({
        onclick: add,
        style: 'padding: 8px 16px; margin-bottom: 12px;',
      })('Add Item'),

      el('ul').props({ style: 'list-style: none; padding: 0; margin: 0;' })(
        map(
          items,
          (item) => item.id,
          (item) =>
            el('li').props({
              style: 'display: flex; align-items: center; gap: 8px; padding: 4px 0;',
            })(
              el('span')(() => item().text),
              el('button').props({
                onclick: () => remove(item().id),
                style: 'padding: 2px 8px; font-size: 12px;',
              })('x')
            )
        )
      )
    );
  };

const app = svc.mount(svc(App)());
export default app.element;
