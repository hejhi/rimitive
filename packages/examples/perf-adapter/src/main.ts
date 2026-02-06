import { signal, computed, el, map, mount } from './service';

// Counter - green for normal clicks, purple for rapid clicks
const Counter = () => {
  const count = signal(0);

  return el('div').props({
    style: 'padding: 16px; margin: 12px 0; background: #1e293b; border-radius: 8px; border: 1px solid #334155;',
  })(
    el('h3').props({ style: 'margin: 0 0 8px 0;' })('Counter'),
    el('p').props({ style: 'margin: 0 0 12px 0; color: #94a3b8; font-size: 14px;' })(
      'Normal clicks flash green — rapid clicks flash purple'
    ),
    el('div').props({ style: 'display: flex; align-items: center; gap: 16px;' })(
      el('button').props({
        onclick: () => count(count() + 1),
        style: 'padding: 10px 20px; cursor: pointer; font-size: 14px;',
      })('Increment'),
      el('span').props({ style: 'font-size: 18px;' })(computed(() => `Count: ${count()}`))
    )
  );
};

// Dynamic elements - click to add many elements at once
const ManyElements = () => {
  const items = signal<number[]>([]);

  const addMany = () => {
    const newItems = Array.from({ length: 50 }, (_, i) => items().length + i);
    items([...items(), ...newItems]);
  };

  const clear = () => items([]);

  return el('div').props({
    style: 'padding: 16px; margin: 12px 0; background: #1e293b; border-radius: 8px; border: 1px solid #334155;',
  })(
    el('h3').props({ style: 'margin: 0 0 8px 0;' })('Bulk Render'),
    el('p').props({ style: 'margin: 0 0 12px 0; color: #94a3b8; font-size: 14px;' })(
      'Add 50 elements at once'
    ),
    el('div').props({ style: 'display: flex; align-items: center; gap: 16px; margin-bottom: 12px;' })(
      el('button').props({
        onclick: addMany,
        style: 'padding: 10px 20px; cursor: pointer; font-size: 14px;',
      })('Add 50'),
      el('button').props({
        onclick: clear,
        style: 'padding: 10px 20px; cursor: pointer; font-size: 14px;',
      })('Clear'),
      el('span').props({ style: 'font-size: 14px; color: #94a3b8;' })(
        computed(() => `${items().length} items`)
      )
    ),
    el('div').props({
      style: 'display: flex; flex-wrap: wrap; gap: 4px;',
    })(
      map(
        items,
        (n) => n,
        (n) =>
          el('span').props({
            style: 'padding: 2px 6px; background: #334155; border-radius: 4px; font-size: 12px;',
          })(computed(() => String(n())))
      )
    )
  );
};

// Long task demo - deliberately blocks the main thread
const LongTaskDemo = () => {
  const result = signal('');

  const blockMainThread = () => {
    result('Computing...');
    // Use setTimeout so the signal update renders before we block
    setTimeout(() => {
      const start = performance.now();
      // Block for ~100ms
      while (performance.now() - start < 100) {
        Math.random();
      }
      result(`Done in ${Math.round(performance.now() - start)}ms`);
    }, 0);
  };

  return el('div').props({
    style: 'padding: 16px; margin: 12px 0; background: #1e293b; border-radius: 8px; border: 1px solid #334155;',
  })(
    el('h3').props({ style: 'margin: 0 0 8px 0;' })('Long Task Detection'),
    el('p').props({ style: 'margin: 0 0 12px 0; color: #94a3b8; font-size: 14px;' })(
      'Deliberately blocks main thread for 100ms — watch for orange flash'
    ),
    el('div').props({ style: 'display: flex; align-items: center; gap: 16px;' })(
      el('button').props({
        onclick: blockMainThread,
        style: 'padding: 10px 20px; cursor: pointer; font-size: 14px;',
      })('Trigger Long Task'),
      el('span').props({ style: 'font-size: 14px; color: #94a3b8;' })(computed(() => result()))
    )
  );
};

// App layout
const App = () => {
  return el('div')(
    el('h1').props({ style: 'margin: 0 0 8px 0;' })('Performance Adapter'),
    el('p').props({ style: 'margin: 0 0 24px 0; color: #94a3b8;' })(
      'Swap in a performance adapter to visualize render costs. Elements flash based on timing:'
    ),
    el('div').props({
      style: 'display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; font-size: 14px;',
    })(
      el('span')(
        el('span').props({ style: 'display: inline-block; width: 12px; height: 12px; background: #22c55e; border-radius: 2px; margin-right: 6px;' })(),
        'Fast (<5ms)'
      ),
      el('span')(
        el('span').props({ style: 'display: inline-block; width: 12px; height: 12px; background: #eab308; border-radius: 2px; margin-right: 6px;' })(),
        'Moderate (5-16ms)'
      ),
      el('span')(
        el('span').props({ style: 'display: inline-block; width: 12px; height: 12px; background: #ef4444; border-radius: 2px; margin-right: 6px;' })(),
        'Slow (>16ms)'
      ),
      el('span')(
        el('span').props({ style: 'display: inline-block; width: 12px; height: 12px; background: #a855f7; border-radius: 2px; margin-right: 6px;' })(),
        'Frequent updates'
      ),
      el('span')(
        el('span').props({ style: 'display: inline-block; width: 12px; height: 12px; background: #f97316; border-radius: 2px; margin-right: 6px;' })(),
        'Long task (>50ms)'
      )
    ),
    Counter(),
    ManyElements(),
    LongTaskDemo(),
    el('div').props({
      style: 'margin-top: 24px; padding: 16px; background: #1e293b; border-radius: 8px; border: 1px solid #334155;',
    })(
      el('h3').props({ style: 'margin: 0 0 8px 0;' })('How it works'),
      el('p').props({ style: 'margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.6;' })(
        'The performance adapter wraps the DOM adapter and measures every render. ',
        'Same components, same code — just a different adapter. ',
        'Check the console for warnings on slow renders and frequent updates.'
      )
    )
  );
};

const app = mount(App());
document.getElementById('app')!.appendChild(app.element!);
