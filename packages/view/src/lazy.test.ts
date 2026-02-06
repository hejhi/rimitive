/**
 * Tests for LazyModule / createLazyFunction
 */

import { describe, it, expect, vi } from 'vitest';
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createLazyFunction, type LazyOpts } from './lazy';
import { isAsyncFragment, getAsyncMeta } from './load';
import { STATUS_REF_SPEC } from './types';
import type { RefSpec, NodeRef } from './types';
import { createDOMAdapter } from './adapters/dom';
import { ElModule } from './el';
import { MatchModule } from './match';

const adapter = createDOMAdapter();
const createService = () =>
  compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    ElModule.with({ adapter }),
    MatchModule.with({ adapter }),
  );

function lazyOpts(): LazyOpts {
  const svc = createService();
  return { signal: svc.signal, match: svc.match as LazyOpts['match'] };
}

/** Flush microtasks */
const flush = () => new Promise<void>((r) => queueMicrotask(r));

/** Create a deferred promise for controlling resolution timing */
function deferred<T>() {
  let resolve!: (val: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Two-level mock — (svc) => (props) => RefSpec (used by fast-path tests) */
function mockComponent(label: string) {
  return (svc: unknown) =>
    (props: { text: string }): RefSpec<unknown> => {
      const spec = (() => spec) as unknown as RefSpec<unknown>;
      spec.status = STATUS_REF_SPEC;
      spec.create = (): NodeRef<unknown> =>
        ({
          status: 1 as const,
          element: { tag: label, text: props.text, svc },
          parent: null,
          prev: null,
          next: null,
          firstChild: null,
          lastChild: null,
        }) as NodeRef<unknown>;
      return spec;
    };
}

/** Single-level mock — (props) => RefSpec (what the lazy boundary intercepts) */
function mockFactory(label: string) {
  return (props: { text: string }): RefSpec<unknown> => {
    const spec = (() => spec) as unknown as RefSpec<unknown>;
    spec.status = STATUS_REF_SPEC;
    spec.create = (): NodeRef<unknown> =>
      ({
        status: 1 as const,
        element: { tag: label, text: props.text },
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
      }) as NodeRef<unknown>;
    return spec;
  };
}

describe('createLazyFunction()', () => {
  describe('fast path (cached)', () => {
    it('should call through directly when import is already resolved', async () => {
      const lazy = createLazyFunction(lazyOpts());
      const realComponent = mockComponent('chart');
      const LazyChart = lazy(() => Promise.resolve(realComponent));

      await flush();

      const factory = LazyChart('svc-instance');
      const spec = factory({ text: 'hello' });

      expect(spec.status).toBe(STATUS_REF_SPEC);
      const node = spec.create();
      expect((node.element as { tag: string }).tag).toBe('chart');
      expect((node.element as { text: string }).text).toBe('hello');
    });

    it('should use fast path on second call after first resolves', async () => {
      const lazy = createLazyFunction(lazyOpts());
      const fn = vi.fn(mockComponent('widget'));
      const LazyWidget = lazy(() => Promise.resolve(fn));

      await flush();

      LazyWidget('svc1');
      expect(fn).toHaveBeenCalledWith('svc1');

      LazyWidget('svc2');
      expect(fn).toHaveBeenCalledWith('svc2');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('slow path (pending)', () => {
    it('should return a RefSpec with async metadata', async () => {
      const lazy = createLazyFunction(lazyOpts());
      const { promise, resolve } = deferred<
        (props: { text: string }) => RefSpec<unknown>
      >();
      const LazyChart = lazy(() => promise);

      const spec = LazyChart({ text: 'pending' });
      expect(spec.status).toBe(STATUS_REF_SPEC);

      const node = spec.create();
      expect(isAsyncFragment(node)).toBe(true);

      const meta = getAsyncMeta(node)!;
      expect(meta.isResolved()).toBe(false);

      resolve(mockFactory('chart'));
      await flush();
    });

    it('should resolve via meta.resolve()', async () => {
      const lazy = createLazyFunction(lazyOpts());
      const { promise, resolve } = deferred<
        (props: { text: string }) => RefSpec<unknown>
      >();
      const LazyChart = lazy(() => promise);

      const spec = LazyChart({ text: 'data' });
      const node = spec.create();

      const meta = getAsyncMeta(node)!;
      expect(meta.isResolved()).toBe(false);

      resolve(mockFactory('chart'));
      const result = await meta.resolve();

      expect(meta.isResolved()).toBe(true);
      expect(typeof result).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should propagate import rejection via meta.resolve()', async () => {
      const lazy = createLazyFunction(lazyOpts());
      const error = new Error('chunk failed to load');
      type Factory = (props: { text: string }) => RefSpec<unknown>;
      const LazyBroken = lazy<Factory>(() => Promise.reject(error));

      await flush();

      const spec = LazyBroken({ text: 'test' });
      const node = spec.create();

      const meta = getAsyncMeta(node)!;
      await expect(meta.resolve()).rejects.toThrow('chunk failed to load');
    });

    it('should reject meta.resolve() when import fails after creation', async () => {
      const lazy = createLazyFunction(lazyOpts());
      type Factory = (props: { text: string }) => RefSpec<unknown>;
      const { promise, reject } = deferred<Factory>();
      const LazyComp = lazy(() => promise);

      const spec = LazyComp({ text: 'test' });
      const node = spec.create();

      const meta = getAsyncMeta(node)!;

      reject(new Error('network error'));

      await expect(meta.resolve()).rejects.toThrow('network error');
    });
  });

  describe('preloadAll()', () => {
    it('should resolve when all lazy imports are loaded', async () => {
      const lazy = createLazyFunction(lazyOpts());
      const { promise: p1, resolve: r1 } = deferred<() => void>();
      const { promise: p2, resolve: r2 } = deferred<() => void>();

      lazy(() => p1);
      lazy(() => p2);

      let resolved = false;
      const all = lazy.preloadAll().then(() => {
        resolved = true;
      });

      await flush();
      expect(resolved).toBe(false);

      r1(() => {});
      await flush();
      expect(resolved).toBe(false);

      r2(() => {});
      await flush();
      await all;
      expect(resolved).toBe(true);
    });

    it('should resolve immediately when no lazy imports are pending', async () => {
      const lazy = createLazyFunction(lazyOpts());
      await expect(lazy.preloadAll()).resolves.toBeUndefined();
    });

    it('should handle rejected imports in preloadAll', async () => {
      const lazy = createLazyFunction(lazyOpts());
      const { promise: p1, resolve: r1 } = deferred<() => void>();
      const { promise: p2, reject: rej2 } = deferred<() => void>();

      lazy(() => p1);
      lazy(() => p2);

      r1(() => {});
      rej2(new Error('fail'));

      await flush();
      await flush();
    });

    it('should have isolated registries per instance', async () => {
      const a = createLazyFunction(lazyOpts());
      const b = createLazyFunction(lazyOpts());

      const { promise: p1, resolve: r1 } = deferred<() => void>();
      const { promise: p2, resolve: r2 } = deferred<() => void>();

      a(() => p1);
      b(() => p2);

      r1(() => {});
      await flush();

      let aResolved = false;
      a.preloadAll().then(() => {
        aResolved = true;
      });
      await flush();
      expect(aResolved).toBe(true);

      let bResolved = false;
      const bAll = b.preloadAll().then(() => {
        bResolved = true;
      });
      await flush();
      expect(bResolved).toBe(false);

      r2(() => {});
      await flush();
      await bAll;
      expect(bResolved).toBe(true);
    });
  });
});
