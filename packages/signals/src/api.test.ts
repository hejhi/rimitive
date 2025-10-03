import { describe, it, expect } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import type { LatticeExtension } from '@lattice/lattice';
import type { Dependency } from './types';
import { createBaseContext } from './context';
import { createScheduler } from './helpers/scheduler';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createGraphTraversal } from './helpers/graph-traversal';

export function createDefaultContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges({ ctx });
  const { traverseGraph } = createGraphTraversal();

  return {
    ctx,
    ...graphEdges,
    ...createPullPropagator({ track: graphEdges.track }),
    ...createScheduler({
      propagate: traverseGraph,
      detachAll: graphEdges.detachAll,
    }),
  };
}

describe('createSignalAPI', () => {
  it('should compose factories into API', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    }, createDefaultContext());

    expect(api.signal).toBeDefined();
    expect(api.computed).toBeDefined();
    expect(api.effect).toBeDefined();
    expect(api.batch).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(api.dispose).toBeDefined();
  });

  it('should support minimal API (tree-shaking)', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    }, createDefaultContext());

    expect(api.signal).toBeDefined();
    expect(api.computed).toBeDefined();
    expect('effect' in api).toBe(false);
    expect('batch' in api).toBe(false);
  });

  it('should work with custom context', () => {
    let schedulerCalled = false;

    const ctx = createBaseContext();
    const graphEdges = createGraphEdges({ ctx });
    const { traverseGraph } = createGraphTraversal();
    const scheduler = createScheduler({
      propagate: traverseGraph,
      detachAll: graphEdges.detachAll
    });

    const api = createSignalAPI(
      {
        signal: createSignalFactory,
        computed: createComputedFactory,
        effect: createEffectFactory,
      },
      {
        ctx,
        ...graphEdges,
        ...scheduler,
        ...createPullPropagator({ track: graphEdges.track }),
        propagate: (subscribers: Dependency) => {
          schedulerCalled = true;
          scheduler.propagate(subscribers);
        },
      }
    );

    const count = api.signal(0);
    api.effect(() => void count());
    count(1);

    expect(schedulerCalled).toBe(true);
  });

  it('should support custom extensions', () => {
    const createCustomFactory = (): LatticeExtension<'custom', () => string> => ({
      name: 'custom',
      method: () => 'works'
    });

    const api = createSignalAPI({
      signal: createSignalFactory,
      custom: createCustomFactory
    }, createDefaultContext());

    expect(api.custom()).toBe('works');
  });

  it('should support multiple independent APIs', () => {
    const api1 = createSignalAPI({
      signal: createSignalFactory,
      effect: createEffectFactory,
    }, createDefaultContext());

    const api2 = createSignalAPI({
      signal: createSignalFactory,
      effect: createEffectFactory,
    }, createDefaultContext());

    const s1 = api1.signal(0);
    const s2 = api2.signal(0);
    let runs1 = 0;
    let runs2 = 0;

    api1.effect(() => { void s1(); runs1++; });
    api2.effect(() => { void s2(); runs2++; });

    s1(1);
    expect(runs1).toBe(2);
    expect(runs2).toBe(1); // Should not affect api2

    s2(1);
    expect(runs1).toBe(2); // Should not affect api1
    expect(runs2).toBe(2);
  });
});
