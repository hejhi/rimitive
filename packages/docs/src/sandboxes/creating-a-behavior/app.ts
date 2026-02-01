import { svc, type Service } from './svc.ts';

// A reusable counter behavior - just logic, no UI
const counter =
  ({ signal, computed }: Pick<Service, 'signal' | 'computed'>) =>
  (initial = 0) => {
    const count = signal(initial);
    const doubled = computed(() => count() * 2);

    return {
      count,
      doubled,
      increment: () => count(count() + 1),
    };
  };

const App = (svc: Service) => {
  const { computed, el } = svc;
  const Counter = svc(counter);

  return () => {
    const c = Counter(0);

    // Minimal UI - just enough to show the behavior works
    return el('div').props({ style: 'font-family: system-ui; padding: 16px;' })(
      el('div')(computed(() => `Count: ${c.count()} | Doubled: ${c.doubled()}`)),
      el('button').props({ onclick: c.increment, style: 'margin-top: 8px;' })(
        'Increment'
      )
    );
  };
};

const app = svc.mount(svc(App)());
export default app.element;
