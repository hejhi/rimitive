import { svc, type Service } from './svc.ts';

const App =
  ({ signal, el, computed, match }: Service) =>
  () => {
    const showMessage = signal(false);

    return el('div').props({ style: 'font-family: system-ui; padding: 16px;' })(
      el('h3')('Conditional Rendering with match()'),

      el('button').props({
        onclick: () => showMessage(!showMessage()),
        style: 'padding: 8px 16px; margin-bottom: 12px;',
      })(computed(() => (showMessage() ? 'Hide' : 'Show'))),

      match(showMessage, (show) =>
        show
          ? el('div').props({
              style: 'padding: 12px; background: #2a4a3a; border-radius: 4px;',
            })('Hello! Toggle me with the button above.')
          : null
      )
    );
  };

const app = svc.mount(svc(App)());
export default app.element;
