import { createApi } from '@lattice/lattice';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createScopes } from '@lattice/view/helpers/scope';
import { createProcessChildren } from '@lattice/view/helpers/processChildren';
import { createElFactory } from '@lattice/view/el';
import type { ElementProps } from '@lattice/view/el';
import { createMapHelper } from '@lattice/view/helpers/map';
import { createLatticeContext } from '@lattice/view/context';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createOnFactory } from '@lattice/view/on';
import { createWithScope, createWithElementScope } from '@lattice/view/helpers/with-scope';
import { createScopedEffect } from '@lattice/view/helpers/scoped-effect';
import { ElRefSpecChild, isReactive, type Reactive } from '@lattice/view/types';

type ClassValue = string | Reactive<string> | null | undefined | false;

function cn(...classes: ClassValue[]): string | Reactive<string> {
  // Check if any are reactive
  const hasReactive = classes.some((c) => c && isReactive(c));

  if (hasReactive) {
    // Create a computed that evaluates all classes
    return computed(() => {
      return classes
        .map((c) => {
          if (!c) return '';
          return isReactive(c) ? c() : c;
        })
        .filter(Boolean)
        .join(' ');
    });
  }

  // All static - just join
  return classes.filter((c) => c && typeof c === 'string').join(' ');
}

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
    startBatch: scheduler.startBatch,
    endBatch: scheduler.endBatch,
  };
}

const signalCtx = createSignalContext();
const viewCtx = createLatticeContext();
const renderer = createDOMRenderer();
const { createScope, disposeScope } =
  createScopes({ track: signalCtx.track, dispose: signalCtx.dispose });

const signalFactory = createSignalFactory(signalCtx);
const computedFactory = createComputedFactory(signalCtx);
const effectFactory = createEffectFactory(signalCtx);

const withScope = createWithScope({ ctx: viewCtx, createScope });
const withElementScope = createWithElementScope({ ctx: viewCtx });
const scopedEffect = createScopedEffect({ ctx: viewCtx, baseEffect: effectFactory.method });

const { processChildren } = createProcessChildren({ scopedEffect, renderer });
const onFactory = createOnFactory({ startBatch: signalCtx.startBatch, endBatch: signalCtx.endBatch });

const elFactory = createElFactory({
  ctx: viewCtx,
  scopedEffect,
  renderer,
  withScope,
  processChildren,
});
const map = createMapHelper({
  ctx: viewCtx,
  scopedEffect,
  withElementScope,
  renderer,
  disposeScope,
  signalCtx: signalCtx.ctx,
  signal: signalFactory.method,
});

const api = createApi(
  {
    signal: () => signalFactory,
    computed: () => computedFactory,
    effect: () => effectFactory,
    el: () => elFactory,
  },
  {}
);

const { signal, el, computed } = api;
const on = onFactory.method;

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
  props: ElementProps<'button'> & { id: string },
  children: ElRefSpecChild<HTMLElement>[] = []
) =>
  el([
    'button',
    {
      className: cn(
        'btn',
        'btn-primary',
        'btn-block',
        'col-sm-6',
        'smallpad',
        props.className
      ),
      type: 'button',
      ...props,
    },
    ...children,
  ]);

const Row = (
  props: { data: Reactive<RowData>; key: number },
  children: ElRefSpecChild<HTMLElement>[] = []
) => {
  const id = props.data().id;
  const label = props.data().label;
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
        el(['span', { className: 'glyphicon glyphicon-remove', ariaHidden: 'true' }]),
      ])((a) => on(a, 'click', () => remove(id))),
    ]),
    el(['td', { className: 'col-md-6' }]),
    ...children,
  ], props.key);
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
            Button({ id: 'run' }, ['Create 1,000 rows'])((btn) =>
              on(btn, 'click', run)
            ),
            Button({ id: 'runlots' }, ['Create 10,000 rows'])((btn) =>
              on(btn, 'click', runLots)
            ),
            Button({ id: 'add' }, ['Append 1,000 rows'])((btn) =>
              on(btn, 'click', add)
            ),
            Button({ id: 'update' }, ['Update every 10th row'])((btn) =>
              on(btn, 'click', update)
            ),
            Button({ id: 'clear' }, ['Clear'])((btn) =>
              on(btn, 'click', clear)
            ),
            Button({ id: 'swaprows' }, ['Swap Rows'])((btn) =>
              on(btn, 'click', swapRows)
            ),
          ]),
        ]),
      ]),
    ]),
    el([
      'table',
      { className: 'table table-hover table-striped test-data' },
      el([
        'tbody',
        map(
          () => data(),
          (rowDataSignal) => Row({ data: rowDataSignal, key: rowDataSignal().id }),
          (rowData) => rowData.id
        ),
      ]),
    ]),
    el([
      'span',
      {
        className: 'preloadicon glyphicon glyphicon-remove',
        ariaHidden: 'true',
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
  appElement.appendChild(app.create().element as HTMLElement);
}
