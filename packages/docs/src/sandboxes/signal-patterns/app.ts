import { signal, computed, el, mount } from './svc.ts';
import { toggle } from './toggle.ts';
import { withPrevious } from './with-previous.ts';

const App = () => {
  // Pattern 1: Toggle - boolean with convenience methods
  const darkMode = toggle({ signal })(false);

  // Pattern 2: Previous value tracking
  const count = withPrevious({ signal, computed })(0);

  return el('div').props({ style: 'font-family: system-ui; padding: 16px;' })(
    el('h3')('Signal Patterns'),

    // Toggle pattern
    el('div').props({ style: 'margin-bottom: 16px;' })(
      el('strong')('Toggle'),
      el('div').props({ style: 'margin-top: 8px;' })(
        el('button').props({
          onclick: darkMode.toggle,
          style: computed(
            () =>
              `padding: 8px 16px; background: ${darkMode() ? '#333' : '#eee'}; color: ${darkMode() ? '#fff' : '#000'}; border: none; border-radius: 4px;`
          ),
        })(computed(() => (darkMode() ? 'Dark: ON' : 'Dark: OFF')))
      )
    ),

    // Previous value pattern
    el('div').props({ style: 'border-top: 1px solid #444; padding-top: 16px;' })(
      el('strong')('Previous Value'),
      el('div').props({ style: 'margin-top: 8px;' })(
        computed(
          () =>
            `Current: ${count.current()} | Previous: ${count.previous()} | Changed: ${count.changed()}`
        )
      ),
      el('div').props({ style: 'display: flex; gap: 8px; margin-top: 8px;' })(
        el('button').props({ onclick: () => count.set(count.current() - 1) })('-'),
        el('button').props({ onclick: () => count.set(count.current() + 1) })('+')
      )
    )
  );
};

const app = mount(App());
export default app.element;
