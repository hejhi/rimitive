import { signal, computed, el, mount } from './svc.ts';

// A simple greeting component
const Greeting = (name: string) =>
  el('div')(el('h2')(`Hello, ${name}!`), el('p')('Welcome to Rimitive.'));

// Counter with reactive UI
const Counter = () => {
  const count = signal(0);
  const doubled = computed(() => count() * 2);

  return el('div')(
    el('div')(computed(() => `Count: ${count()} (doubled: ${doubled()})`)),
    el('div').props({ style: 'display: flex; gap: 8px; margin-top: 8px;' })(
      el('button').props({ onclick: () => count(count() - 1) })('-'),
      el('button').props({ onclick: () => count(count() + 1) })('+')
    )
  );
};

const App = () =>
  el('div').props({ style: 'font-family: system-ui; padding: 16px;' })(
    Greeting('World'),
    el('hr').props({
      style: 'margin: 16px 0; border: none; border-top: 1px solid #444;',
    })(),
    Counter()
  );

const app = mount(App());
export default app.element;
