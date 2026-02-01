import { signal, computed, el, on, mount } from './svc.ts';

const App = () => {
  const count = signal(0);
  const lastKey = signal('');

  return el('div').props({ style: 'font-family: system-ui; padding: 16px;' })(
    el('h3')('Event Handling with on()'),

    // Click events
    el('div').props({ style: 'margin-bottom: 16px;' })(
      el('button')
        .props({ style: 'padding: 8px 16px;' })
        .ref(on('click', () => count(count() + 1)))('Click me'),
      el('span').props({ style: 'margin-left: 12px;' })(
        computed(() => `Clicked ${count()} times`)
      )
    ),

    // Keyboard events
    el('div')(
      el('input')
        .props({
          type: 'text',
          placeholder: 'Type something...',
          style: 'padding: 8px;',
        })
        .ref(on('keydown', (e) => lastKey((e as KeyboardEvent).key)))(),
      el('span').props({ style: 'margin-left: 12px;' })(
        computed(() => (lastKey() ? `Last key: ${lastKey()}` : ''))
      )
    )
  );
};

const app = mount(App());
export default app.element;
