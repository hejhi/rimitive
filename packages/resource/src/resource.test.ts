import { describe, it, expect, vi } from 'vitest';
import { compose } from '@rimitive/core';
import { SignalModule } from '@rimitive/signals/signal';
import { ComputedModule } from '@rimitive/signals/computed';
import { EffectModule } from '@rimitive/signals/effect';
import { ResourceModule } from './resource';

// Helper to create a deferred promise for controlled async testing
function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Helper to flush microtasks
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

describe('resource', () => {
  const createTestEnv = () => {
    const use = compose(
      SignalModule,
      ComputedModule,
      EffectModule,
      ResourceModule
    );
    return use;
  };

  describe('basic functionality', () => {
    it('should start in pending state', () => {
      const { resource } = createTestEnv();
      const deferred = createDeferred<string>();

      const res = resource(() => deferred.promise);

      expect(res()).toEqual({ status: 'pending' });
      expect(res.loading()).toBe(true);
      expect(res.data()).toBe(undefined);
      expect(res.error()).toBe(undefined);
    });

    it('should transition to ready state on success', async () => {
      const { resource } = createTestEnv();
      const deferred = createDeferred<string>();

      const res = resource(() => deferred.promise);

      deferred.resolve('hello');
      await flushMicrotasks();

      expect(res()).toEqual({ status: 'ready', value: 'hello' });
      expect(res.loading()).toBe(false);
      expect(res.data()).toBe('hello');
      expect(res.error()).toBe(undefined);
    });

    it('should transition to error state on failure', async () => {
      const { resource } = createTestEnv();
      const deferred = createDeferred<string>();

      const res = resource(() => deferred.promise);

      const error = new Error('failed');
      deferred.reject(error);
      await flushMicrotasks();

      expect(res()).toEqual({ status: 'error', error });
      expect(res.loading()).toBe(false);
      expect(res.data()).toBe(undefined);
      expect(res.error()).toBe(error);
    });

    it('should handle sync errors in fetcher', () => {
      const { resource } = createTestEnv();
      const error = new Error('sync error');

      const res = resource(() => {
        throw error;
      });

      expect(res()).toEqual({ status: 'error', error });
      expect(res.loading()).toBe(false);
      expect(res.error()).toBe(error);
    });
  });

  describe('reactive dependency tracking', () => {
    it('should refetch when dependencies change', async () => {
      const { signal, resource } = createTestEnv();
      const fetchCount = vi.fn();

      const id = signal(1);
      const resolvers: Array<(value: string) => void> = [];

      const res = resource(() => {
        const currentId = id();
        fetchCount();
        return new Promise<string>((resolve) => {
          resolvers.push((v) => resolve(`${v}-${currentId}`));
        });
      });

      // First fetch triggered
      expect(fetchCount).toHaveBeenCalledTimes(1);
      expect(res.loading()).toBe(true);

      // Resolve first fetch
      resolvers[0]!('data');
      await flushMicrotasks();
      expect(res.data()).toBe('data-1');

      // Change dependency - should trigger refetch
      id(2);
      expect(fetchCount).toHaveBeenCalledTimes(2);
      expect(res.loading()).toBe(true);

      // Resolve second fetch
      resolvers[1]!('data');
      await flushMicrotasks();
      expect(res.data()).toBe('data-2');
    });

    it('should track multiple dependencies', async () => {
      const { signal, resource } = createTestEnv();

      const category = signal('electronics');
      const page = signal(1);

      let lastFetchArgs: { category: string; page: number } | null = null;
      resource(() => {
        lastFetchArgs = { category: category(), page: page() };
        return Promise.resolve(lastFetchArgs);
      });

      await flushMicrotasks();
      expect(lastFetchArgs).toEqual({ category: 'electronics', page: 1 });

      // Change category
      category('books');
      await flushMicrotasks();
      expect(lastFetchArgs).toEqual({ category: 'books', page: 1 });

      // Change page
      page(2);
      await flushMicrotasks();
      expect(lastFetchArgs).toEqual({ category: 'books', page: 2 });
    });
  });

  describe('race condition handling', () => {
    it('should ignore stale responses', async () => {
      const { signal, resource } = createTestEnv();

      const id = signal(1);
      const deferreds: Array<ReturnType<typeof createDeferred<string>>> = [];

      const res = resource(() => {
        const currentId = id();
        const deferred = createDeferred<string>();
        deferreds.push(deferred);
        return deferred.promise.then((v) => `${v}-${currentId}`);
      });

      // First fetch started
      expect(deferreds.length).toBe(1);

      // Trigger second fetch before first resolves
      id(2);
      expect(deferreds.length).toBe(2);

      // Resolve second fetch first
      deferreds[1]!.resolve('fast');
      await flushMicrotasks();
      expect(res.data()).toBe('fast-2');

      // Resolve first fetch (stale) - should be ignored
      deferreds[0]!.resolve('slow');
      await flushMicrotasks();
      expect(res.data()).toBe('fast-2'); // Still the second result
    });

    it('should ignore stale errors', async () => {
      const { signal, resource } = createTestEnv();

      const id = signal(1);
      const deferreds: Array<ReturnType<typeof createDeferred<string>>> = [];

      const res = resource(() => {
        id(); // track dependency
        const deferred = createDeferred<string>();
        deferreds.push(deferred);
        return deferred.promise;
      });

      // Trigger second fetch
      id(2);
      expect(deferreds.length).toBe(2);

      // Resolve second fetch
      deferreds[1]!.resolve('success');
      await flushMicrotasks();
      expect(res.data()).toBe('success');

      // First fetch errors (stale) - should be ignored
      deferreds[0]!.reject(new Error('stale error'));
      await flushMicrotasks();
      expect(res().status).toBe('ready'); // Still ready, not error
    });
  });

  describe('refetch', () => {
    it('should manually trigger refetch', async () => {
      const { resource } = createTestEnv();
      let fetchCount = 0;

      const res = resource(() => {
        fetchCount++;
        return Promise.resolve(`fetch-${fetchCount}`);
      });

      await flushMicrotasks();
      expect(res.data()).toBe('fetch-1');

      res.refetch();
      await flushMicrotasks();
      expect(res.data()).toBe('fetch-2');

      res.refetch();
      await flushMicrotasks();
      expect(res.data()).toBe('fetch-3');
    });
  });

  describe('integration with computed', () => {
    it('should work with derived computations', async () => {
      const { computed, resource } = createTestEnv();

      const res = resource(() => Promise.resolve([1, 2, 3, 4, 5]));

      const sum = computed(() => {
        const data = res.data();
        return data ? data.reduce((a, b) => a + b, 0) : 0;
      });

      expect(sum()).toBe(0); // Pending

      await flushMicrotasks();
      expect(sum()).toBe(15); // Ready
    });
  });

  describe('abort signal', () => {
    it('should pass abort signal to fetcher', () => {
      const { resource } = createTestEnv();
      let receivedSignal: AbortSignal | undefined;

      resource((signal) => {
        receivedSignal = signal;
        return Promise.resolve('data');
      });

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
      expect(receivedSignal?.aborted).toBe(false);
    });

    it('should abort previous request when deps change', async () => {
      const { signal, resource } = createTestEnv();
      const signals: AbortSignal[] = [];

      const id = signal(1);

      resource((abortSignal) => {
        signals.push(abortSignal);
        id(); // track dependency
        return new Promise(() => {}); // never resolves
      });

      expect(signals.length).toBe(1);
      expect(signals[0]?.aborted).toBe(false);

      // Change dependency - should abort previous and start new
      id(2);

      expect(signals.length).toBe(2);
      expect(signals[0]?.aborted).toBe(true); // Previous aborted
      expect(signals[1]?.aborted).toBe(false); // New one active
    });

    it('should abort on dispose', async () => {
      const { resource } = createTestEnv();
      let receivedSignal: AbortSignal | undefined;

      const res = resource((signal) => {
        receivedSignal = signal;
        return new Promise(() => {}); // never resolves
      });

      expect(receivedSignal?.aborted).toBe(false);

      res.dispose();

      expect(receivedSignal?.aborted).toBe(true);
    });

    it('should not set error state for abort errors', async () => {
      const { signal, resource } = createTestEnv();

      const id = signal(1);

      const res = resource((abortSignal) => {
        id(); // track dependency
        return new Promise((_, reject) => {
          abortSignal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      expect(res().status).toBe('pending');

      // Change dep - triggers abort of first request
      id(2);
      await flushMicrotasks();

      // Should still be pending (new fetch in progress), not error
      expect(res().status).toBe('pending');
      expect(res.error()).toBe(undefined);
    });

    it('should stop reacting after dispose', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const id = signal(1);

      const res = resource(() => {
        id(); // track dependency
        fetchCount++;
        return Promise.resolve(`fetch-${fetchCount}`);
      });

      expect(fetchCount).toBe(1);

      res.dispose();

      // Changing dep after dispose should not trigger refetch
      id(2);
      expect(fetchCount).toBe(1);
    });
  });

  describe('enabled option', () => {
    it('should start in idle state when enabled is false', () => {
      const { resource } = createTestEnv();
      let fetchCount = 0;

      const res = resource(
        () => {
          fetchCount++;
          return Promise.resolve('data');
        },
        { enabled: false }
      );

      expect(res()).toEqual({ status: 'idle' });
      expect(res.idle()).toBe(true);
      expect(res.loading()).toBe(false);
      expect(res.data()).toBe(undefined);
      expect(fetchCount).toBe(0);
    });

    it('should fetch when enabled is true', async () => {
      const { resource } = createTestEnv();

      const res = resource(() => Promise.resolve('data'), { enabled: true });

      expect(res().status).toBe('pending');

      await flushMicrotasks();
      expect(res.data()).toBe('data');
    });

    it('should fetch when enabled signal becomes true', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const enabled = signal(false);

      const res = resource(
        () => {
          fetchCount++;
          return Promise.resolve('data');
        },
        { enabled }
      );

      // Initially disabled
      expect(res().status).toBe('idle');
      expect(fetchCount).toBe(0);

      // Enable - should trigger fetch
      enabled(true);
      expect(res().status).toBe('pending');
      expect(fetchCount).toBe(1);

      await flushMicrotasks();
      expect(res.data()).toBe('data');
    });

    it('should abort and go idle when enabled becomes false', async () => {
      const { signal, resource } = createTestEnv();
      let abortedSignal: AbortSignal | undefined;

      const enabled = signal(true);

      const res = resource(
        (abortSignal) => {
          abortedSignal = abortSignal;
          return new Promise(() => {}); // never resolves
        },
        { enabled }
      );

      expect(res().status).toBe('pending');
      expect(abortedSignal?.aborted).toBe(false);

      // Disable - should abort and go idle
      enabled(false);
      expect(res().status).toBe('idle');
      expect(abortedSignal?.aborted).toBe(true);
    });

    it('should refetch when re-enabled', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const enabled = signal(true);

      const res = resource(
        () => {
          fetchCount++;
          return Promise.resolve(`fetch-${fetchCount}`);
        },
        { enabled }
      );

      await flushMicrotasks();
      expect(res.data()).toBe('fetch-1');

      // Disable
      enabled(false);
      expect(res().status).toBe('idle');

      // Re-enable - should fetch again
      enabled(true);
      await flushMicrotasks();
      expect(res.data()).toBe('fetch-2');
    });

    it('should still track fetcher dependencies when enabled', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const enabled = signal(true);
      const id = signal(1);

      const res = resource(
        () => {
          const currentId = id();
          fetchCount++;
          return Promise.resolve(`data-${currentId}`);
        },
        { enabled }
      );

      await flushMicrotasks();
      expect(res.data()).toBe('data-1');
      expect(fetchCount).toBe(1);

      // Change dependency - should refetch
      id(2);
      await flushMicrotasks();
      expect(res.data()).toBe('data-2');
      expect(fetchCount).toBe(2);
    });

    it('should not fetch on dependency change when disabled', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const enabled = signal(false);
      const id = signal(1);

      const res = resource(
        () => {
          const currentId = id();
          fetchCount++;
          return Promise.resolve(`data-${currentId}`);
        },
        { enabled }
      );

      expect(fetchCount).toBe(0);

      // Change dependency while disabled - should not fetch
      id(2);
      expect(fetchCount).toBe(0);
      expect(res().status).toBe('idle');

      // Now enable - should fetch with current id value
      enabled(true);
      await flushMicrotasks();
      expect(res.data()).toBe('data-2');
      expect(fetchCount).toBe(1);
    });

    it('should default to enabled when option not provided', async () => {
      const { resource } = createTestEnv();

      const res = resource(() => Promise.resolve('data'));

      expect(res().status).toBe('pending');
      await flushMicrotasks();
      expect(res.data()).toBe('data');
    });
  });

  describe('flush option', () => {
    it('should use sync strategy by default', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const id = signal(1);

      resource(() => {
        id();
        fetchCount++;
        return Promise.resolve('data');
      });

      expect(fetchCount).toBe(1);

      // Change dependency - should fetch synchronously
      id(2);
      expect(fetchCount).toBe(2); // Immediate, not deferred
    });

    it('should defer refetch with microtask strategy', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const id = signal(1);

      // Test-specific microtask strategy (mt uses serverStrategy in Node)
      const testMt = (run: () => void) => {
        let version = 0;
        return {
          run,
          create:
            (track: (node: { cleanup?: () => void }, fn: () => void) => void) =>
            (node: { cleanup?: () => void }) => {
              const thisVersion = ++version;
              queueMicrotask(() => {
                if (thisVersion !== version) return;
                if (node.cleanup !== undefined) node.cleanup = node.cleanup();
                node.cleanup = track(node, run) as (() => void) | undefined;
              });
            },
        };
      };

      resource(
        () => {
          id();
          fetchCount++;
          return Promise.resolve('data');
        },
        { flush: testMt }
      );

      // Initial fetch is always sync
      expect(fetchCount).toBe(1);

      // Change dependency - should not fetch immediately
      id(2);
      expect(fetchCount).toBe(1); // Still 1, deferred

      // Flush microtasks
      await flushMicrotasks();
      expect(fetchCount).toBe(2); // Now fetched
    });

    it('should coalesce rapid updates with microtask strategy', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const id = signal(1);

      // Test-specific microtask strategy (mt uses serverStrategy in Node)
      const testMt = (run: () => void) => {
        let version = 0;
        return {
          run,
          create:
            (track: (node: { cleanup?: () => void }, fn: () => void) => void) =>
            (node: { cleanup?: () => void }) => {
              const thisVersion = ++version;
              queueMicrotask(() => {
                if (thisVersion !== version) return;
                if (node.cleanup !== undefined) node.cleanup = node.cleanup();
                node.cleanup = track(node, run) as (() => void) | undefined;
              });
            },
        };
      };

      resource(
        () => {
          id();
          fetchCount++;
          return Promise.resolve(`data-${id()}`);
        },
        { flush: testMt }
      );

      expect(fetchCount).toBe(1);

      // Rapid updates
      id(2);
      id(3);
      id(4);

      // Still only initial fetch
      expect(fetchCount).toBe(1);

      // After microtask, only one additional fetch
      await flushMicrotasks();
      expect(fetchCount).toBe(2); // Coalesced to single fetch
    });

    it('should work with enabled option', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;

      const enabled = signal(false);
      const id = signal(1);

      // Test-specific microtask strategy (mt uses serverStrategy in Node)
      const testMt = (run: () => void) => {
        let version = 0;
        return {
          run,
          create:
            (track: (node: { cleanup?: () => void }, fn: () => void) => void) =>
            (node: { cleanup?: () => void }) => {
              const thisVersion = ++version;
              queueMicrotask(() => {
                if (thisVersion !== version) return;
                if (node.cleanup !== undefined) node.cleanup = node.cleanup();
                node.cleanup = track(node, run) as (() => void) | undefined;
              });
            },
        };
      };

      const res = resource(
        () => {
          id();
          fetchCount++;
          return Promise.resolve('data');
        },
        { enabled, flush: testMt }
      );

      // Disabled - no fetch
      expect(fetchCount).toBe(0);
      expect(res().status).toBe('idle');

      // Enable - triggers effect re-run (deferred by testMt)
      enabled(true);
      expect(fetchCount).toBe(0); // Deferred

      await flushMicrotasks();
      expect(fetchCount).toBe(1);

      // Change dependency - deferred
      id(2);
      expect(fetchCount).toBe(1);

      await flushMicrotasks();
      expect(fetchCount).toBe(2);
    });

    it('should run once on server with mt (re-runs skipped)', async () => {
      // In Node (no window), mt uses serverStrategy: initial run executes,
      // subsequent re-runs are skipped. This makes resources effectively
      // client-only when using async strategies.
      const { signal, resource } = createTestEnv();
      const { mt } = await import('@rimitive/signals/strategies');
      let fetchCount = 0;

      const id = signal(1);

      resource(
        () => {
          id();
          fetchCount++;
          return Promise.resolve('data');
        },
        { flush: mt }
      );

      // Initial fetch runs (serverStrategy preserves initial run)
      expect(fetchCount).toBe(1);

      // Re-runs are skipped on server
      id(2);
      await flushMicrotasks();
      expect(fetchCount).toBe(1); // Still 1, re-run skipped
    });

    it('should accept custom flush strategy', async () => {
      const { signal, resource } = createTestEnv();
      let fetchCount = 0;
      let flushCalls = 0;

      const id = signal(1);

      // Custom strategy that tracks calls
      const customStrategy = (run: () => void) => ({
        run,
        create: (track: (node: unknown, fn: () => void) => void) => (node: unknown) => {
          flushCalls++;
          // Execute synchronously for testing
          track(node, run);
        },
      });

      resource(
        () => {
          id();
          fetchCount++;
          return Promise.resolve('data');
        },
        { flush: customStrategy }
      );

      expect(fetchCount).toBe(1);
      expect(flushCalls).toBe(0); // Not called for initial run

      id(2);
      expect(flushCalls).toBe(1); // Called on dependency change
      expect(fetchCount).toBe(2);
    });
  });
});
