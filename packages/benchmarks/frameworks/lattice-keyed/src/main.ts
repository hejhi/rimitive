import { createApi } from '@lattice/lattice';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createElFactory } from '@lattice/view/el';
import { createMapFactory } from '@lattice/view/map';
import { createViewContext } from '@lattice/view/context';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { on } from '@lattice/view/on';
import type { Reactive } from '@lattice/view/types';

// ============================================================================
// Create Lattice API
// ============================================================================

function createSignalContext() {
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const _scheduler = createScheduler({ detachAll });
  const { withPropagate, ...scheduler } = _scheduler;
  const pullPropagator = createPullPropagator({ track });

  return {
    ctx,
    trackDependency,
    propagate: withPropagate(withVisitor),
    track,
    dispose: scheduler.dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
  };
}

const signalCtx = createSignalContext();
const viewCtx = createViewContext();
const renderer = createDOMRenderer();

const signalFactory = createSignalFactory(signalCtx);
const computedFactory = createComputedFactory(signalCtx);
const effectFactory = createEffectFactory(signalCtx);

const elFactory = createElFactory({
  ctx: viewCtx,
  effect: effectFactory.method,
  renderer
});
const mapFactory = createMapFactory({
  ctx: viewCtx,
  signal: signalFactory.method,
  effect: effectFactory.method,
  renderer,
});

const api = createApi(
  {
    signal: () => signalFactory,
    computed: () => computedFactory,
    effect: () => effectFactory,
    el: () => elFactory,
    map: () => mapFactory,
  },
  {}
);

const { signal, el, map, computed } = api;

// ============================================================================
// Benchmark Data
// ============================================================================

let idCounter = 1;
const adjectives = [
  'pretty',
  'large',
  'big',
  'small',
  'tall',
  'short',
  'long',
  'handsome',
  'plain',
  'quaint',
  'clean',
  'elegant',
  'easy',
  'angry',
  'crazy',
  'helpful',
  'mushy',
  'odd',
  'unsightly',
  'adorable',
  'important',
  'inexpensive',
  'cheap',
  'expensive',
  'fancy',
];
const colours = [
  'red',
  'yellow',
  'blue',
  'green',
  'pink',
  'brown',
  'purple',
  'brown',
  'white',
  'black',
  'orange',
];
const nouns = [
  'table',
  'chair',
  'house',
  'bbq',
  'desk',
  'car',
  'pony',
  'cookie',
  'sandwich',
  'burger',
  'pizza',
  'mouse',
  'keyboard',
];

function _random(max: number): number {
  return Math.round(Math.random() * 1000) % max;
}

interface RowData {
  id: number;
  label: Reactive<string>;
}

function buildData(count: number): RowData[] {
  const data = new Array(count);
  for (let i = 0; i < count; i++) {
    const label = signal(
      `${adjectives[_random(adjectives.length)]} ${
        colours[_random(colours.length)]
      } ${nouns[_random(nouns.length)]}`
    );
    data[i] = {
      id: idCounter++,
      label,
    };
  }
  return data;
}

// ============================================================================
// App State and Actions
// ============================================================================

const data = signal<RowData[]>([]);
const selected = signal<number | null>(null);

const run = () => {
  data(buildData(1000));
};

const runLots = () => {
  data(buildData(10000));
};

const add = () => {
  data(data().concat(buildData(1000)));
};

const update = () => {
  const d = data();
  for (let i = 0; i < d.length; i += 10) {
    const row = d[i];
    if (!row) continue;
    const labelSignal = row.label as (value?: string) => string | void;
    const currentLabel = labelSignal();
    labelSignal(currentLabel + ' !!!');
  }
};

const swapRows = () => {
  const d = data().slice();
  if (d.length > 998) {
    const tmp = d[1]!;
    d[1] = d[998]!;
    d[998] = tmp;
    data(d);
  }
};

const clear = () => {
  data([]);
};

const remove = (id: number) => {
  const d = data();
  const idx = d.findIndex((item) => item.id === id);
  data([...d.slice(0, idx), ...d.slice(idx + 1)]);
};

const select = (id: number) => {
  selected(id);
};

// ============================================================================
// Components
// ============================================================================

const Button = (id: string, text: string, fn: () => void) =>
  el([
    'div',
    { className: 'col-sm-6 smallpad' },
    el([
      'button',
      {
        id,
        className: 'btn btn-primary btn-block',
        type: 'button',
      },
      text,
    ])((btn) => on(btn, 'click', fn)),
  ]);

const Row = (rowData: Reactive<RowData>) => {
  const id = rowData().id;
  const label = rowData().label;
  const rowClass = computed(() => (selected() === id ? 'danger' : ''));

  return el([
    'tr',
    { className: rowClass },
    el(['td', { className: 'col-md-1' }, String(id)]),
    el([
      'td',
      { className: 'col-md-4' },
      el(['a', label])((a) => on(a, 'click', () => select(id))),
    ]),
    el([
      'td',
      { className: 'col-md-1' },
      el([
        'a',
        el(['span', { className: 'glyphicon glyphicon-remove', 'aria-hidden': 'true' }]),
      ])((a) => on(a, 'click', () => remove(id))),
    ]),
    el(['td', { className: 'col-md-6' }]),
  ]);
};

const App = () => {
  return el([
    'div',
    { className: 'container' },
    el([
      'div',
      { className: 'jumbotron' },
      el([
        'div',
        { className: 'row' },
        el(['div', { className: 'col-md-6' }, el(['h1', 'Lattice-keyed'])]),
        el([
          'div',
          { className: 'col-md-6' },
          el([
            'div',
            { className: 'row' },
            Button('run', 'Create 1,000 rows', run),
            Button('runlots', 'Create 10,000 rows', runLots),
            Button('add', 'Append 1,000 rows', add),
            Button('update', 'Update every 10th row', update),
            Button('clear', 'Clear', clear),
            Button('swaprows', 'Swap Rows', swapRows),
          ]),
        ]),
      ]),
    ]),
    el([
      'table',
      { className: 'table table-hover table-striped test-data' },
      el(['tbody', map(data, Row, (row: RowData) => row.id)]),
    ]),
    el([
      'span',
      {
        className: 'preloadicon glyphicon glyphicon-remove',
        'aria-hidden': 'true',
      },
    ]),
  ]);
};

// ============================================================================
// Mount
// ============================================================================

const appElement = document.getElementById('main');
if (appElement) {
  const app = App();
  appElement.appendChild(app.create());
}
