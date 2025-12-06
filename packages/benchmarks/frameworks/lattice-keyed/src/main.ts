import {
  defaultExtensions as defaultSignalsExtensions,
  defaultHelpers as defaultSignalsHelpers,
} from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createDOMAdapter, DOMAdapterConfig } from '@lattice/view/adapters/dom';
import type { Reactive, ElRefSpecChild } from '@lattice/view/types';
import { compose } from '@lattice/lattice';

// Wire up view layer

const adapter = createDOMAdapter();
const signals = compose(
  defaultSignalsExtensions(),
  defaultSignalsHelpers()
)();
const viewHelpers = defaultViewHelpers(adapter, signals);

/**
 * DOM-specific API for this app
 * Types are automatically inferred from the adapter
 */
const views = compose(
  defaultViewExtensions<DOMAdapterConfig>(),
  viewHelpers
)();

const svc = {
  ...signals,
  ...views,
  addEventListener: createAddEventListener(viewHelpers.batch),
};

const { el, map, addEventListener, signal, computed } = svc;

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

type RowData = {
  id: number;
  label: ReturnType<typeof signal<string>>;
};

function buildData(count: number): RowData[] {
  const data: RowData[] = new Array<RowData>(count);
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

const run = () => data(buildData(1000));

const runLots = () => data(buildData(10000));

const add = () => data(data().concat(buildData(1000)));

const update = () => {
  const d = data();
  for (let i = 0; i < d.length; i += 10) {
    const row = d[i];
    if (!row) continue;
    const currentLabel = row.label();
    row.label(currentLabel + ' !!!');
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

const clear = () => data([]);

const remove = (id: number) => {
  const d = data();
  const idx = d.findIndex((item: RowData) => item.id === id);
  data([...d.slice(0, idx), ...d.slice(idx + 1)]);
};

const select = (id: number) => {
  selected(id);
};

// ============================================================================
// Components
// ============================================================================

const Button = (id: string, label: string, onclick: (ev: MouseEvent) => void) =>
  el('button')
    .props({
      className: 'btn btn-primary btn-block col-sm-6 smallpad',
      type: 'button',
      id,
    })
    // Use more performant addEventListener for batching
    .ref(addEventListener('click', onclick))(label);

const Row = (data: Reactive<RowData>, children: ElRefSpecChild[] = []) => {
  const id = data().id;
  const label = data().label;
  const rowClass = computed(() => (selected() === id ? 'danger' : ''));

  return el('tr').props({ className: rowClass })(
    el('td').props({ className: 'col-md-1' })(String(id)),
    el('td').props({ className: 'col-md-4' })(
      el('a').props({ onclick: () => select(id) })(label)
    ),
    el('td').props({ className: 'col-md-1' })(
      el('a').props({ onclick: () => remove(id) })(
        el('span').props({
          className: 'glyphicon glyphicon-remove',
          ariaHidden: 'true',
        })()
      )
    ),
    el('td').props({ className: 'col-md-6' })(),
    ...children
  );
};

const App = () => {
  return el('div').props({ className: 'container' })(
    el('div').props({ className: 'jumbotron' })(
      el('div').props({ className: 'row' })(
        el('div').props({ className: 'col-md-6' })(el('h1')('Lattice-keyed')),
        el('div').props({ className: 'col-md-6' })(
          el('div').props({ className: 'row' })(
            Button('run', 'Create 1,000 rows', run),
            Button('runlots', 'Create 10,000 rows', runLots),
            Button('add', 'Append 1,000 rows', add),
            Button('update', 'Update every 10th row', update),
            Button('clear', 'Clear', clear),
            Button('swaprows', 'Swap Rows', swapRows)
          )
        )
      )
    ),
    el('table').props({
      className: 'table table-hover table-striped test-data',
    })(el('tbody')(map(data, (rowData: RowData) => rowData.id, Row))),
    el('span').props({
      className: 'preloadicon glyphicon glyphicon-remove',
      ariaHidden: 'true',
    })
  );
};

// ============================================================================
// Mount
// ============================================================================

const appElement = document.getElementById('main');
if (appElement) {
  const app = App();
  const mounted = app.create(svc);
  if (mounted.element) {
    appElement.appendChild(mounted.element as HTMLElement);
  }
}
