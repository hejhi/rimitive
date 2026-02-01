import { signal, computed, el, mount } from './svc.ts';

const App = () => {
  const count = signal(0);
  const doubled = computed(() => count() * 2);

  return el('div').props({ style: 'font-family: system-ui; padding: 16px;' })(
    el('h3')('Counter'),
    el('p')(computed(() => `Count: ${count()}`)),
    el('p')(computed(() => `Doubled: ${doubled()}`)),
    el('button').props({
      onclick: () => count(count() + 1),
      style: 'padding: 8px 16px; cursor: pointer;',
    })('Increment')
  );
};

const app = mount(App());
export default app.element;
