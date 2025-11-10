import { createApi } from '@lattice/view/presets/core';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import type { Reactive, ElRefSpecChild } from '@lattice/view/types';

// Wire up view layer
const { api } = createApi(createDOMRenderer());
const { el, map, on, signal, computed } = api;

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
  label: ReturnType<typeof signal<string>>;
}

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

const Button = (
  id: string,
  label: string
) =>
  el('button', {
    className: 'btn btn-primary btn-block col-sm-6 smallpad',
    type: 'button',
    id
  })(label)();

const Row = (
  data: Reactive<RowData>,
  children: ElRefSpecChild[] = []
) => {
  const id = data().id;
  const label = data().label;
  const rowClass = computed(() => (selected() === id ? 'danger' : ''));

  return el('tr', { className: rowClass })(
    el('td', { className: 'col-md-1' })(String(id))(),
    el('td', { className: 'col-md-4' })(
      el('a')(label)(on('click', () => select(id)))
    )(),
    el('td', { className: 'col-md-1' })(
      el('a')(
        el('span', { className: 'glyphicon glyphicon-remove', ariaHidden: 'true' })()
      )(on('click', () => remove(id)))
    )(),
    el('td', { className: 'col-md-6' })(),
    ...children
  )();
};

const App = () => {
  return el('div', { className: 'container' })(
    el('div', { className: 'jumbotron' })(
      el('div', { className: 'row' })(
        el('div', { className: 'col-md-6' })(el('h1')('Lattice-keyed')())(),
        el('div', { className: 'col-md-6' })(
          el('div', { className: 'row' })(
            Button('run', 'Create 1,000 rows')(on('click', run)),
            Button('runlots', 'Create 10,000 rows')(on('click', runLots)),
            Button('add', 'Append 1,000 rows')(on('click', add)),
            Button('update', 'Update every 10th row')(on('click', update)),
            Button('clear', 'Clear')(on('click', clear)),
            Button('swaprows', 'Swap Rows')(on('click', swapRows))
          )()
        )()
      )()
    )(),
    el('table', { className: 'table table-hover table-striped test-data' })(
      el('tbody')(map(data, (rowData: RowData) => rowData.id)(Row))()
    )(),
    el('span', {
      className: 'preloadicon glyphicon glyphicon-remove',
      ariaHidden: 'true',
    })()
  )();
};

// ============================================================================
// Mount
// ============================================================================

const appElement = document.getElementById('main');
if (appElement) {
  const app = App();
  const mounted = app.create(api);
  if (mounted.element) {
    appElement.appendChild(mounted.element as HTMLElement);
  }
}
