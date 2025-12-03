import { describe, it, expect } from 'vitest';
import type { SSRContext } from './types';
import {
  createSSRContext,
  runWithSSRContext,
  getActiveSSRContext,
  getIslandScripts,
  registerIsland,
} from './ssr-context';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';

describe('SSR Context', () => {
  describe('createSSRContext', () => {
    it('should create context with empty islands array', () => {
      const ctx = createSSRContext();
      expect(ctx.islands).toEqual([]);
    });

    it('should create context with counter at 0', () => {
      const ctx = createSSRContext();
      expect(ctx.islandCounter).toBe(0);
    });

    it('should create new context each time', () => {
      const ctx1 = createSSRContext();
      const ctx2 = createSSRContext();
      expect(ctx1).not.toBe(ctx2);
    });
  });

  describe('runWithSSRContext', () => {
    it('should make context available during execution', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {
        const active = getActiveSSRContext();
        expect(active).toBe(ctx);
      });
    });

    it('should return function result', () => {
      const ctx = createSSRContext();
      const result = runWithSSRContext(ctx, () => 'hello');
      expect(result).toBe('hello');
    });

    it('should clean up context after execution', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {});
      const active = getActiveSSRContext();
      expect(active).toBeUndefined();
    });

    it('should isolate contexts across concurrent calls', async () => {
      const ctx1 = createSSRContext();
      const ctx2 = createSSRContext();

      const results = await Promise.all([
        new Promise<SSRContext | undefined>((resolve) => {
          runWithSSRContext(ctx1, () => {
            setTimeout(() => {
              resolve(getActiveSSRContext());
            }, 10);
          });
        }),
        new Promise<SSRContext | undefined>((resolve) => {
          runWithSSRContext(ctx2, () => {
            setTimeout(() => {
              resolve(getActiveSSRContext());
            }, 10);
          });
        }),
      ]);

      expect(results[0]).toBe(ctx1);
      expect(results[1]).toBe(ctx2);
    });

    it('should support nested contexts', () => {
      const ctx1 = createSSRContext();
      const ctx2 = createSSRContext();

      runWithSSRContext(ctx1, () => {
        expect(getActiveSSRContext()).toBe(ctx1);

        runWithSSRContext(ctx2, () => {
          expect(getActiveSSRContext()).toBe(ctx2);
        });

        expect(getActiveSSRContext()).toBe(ctx1);
      });
    });
  });

  describe('getActiveSSRContext', () => {
    it('should return undefined outside of context', () => {
      const active = getActiveSSRContext();
      expect(active).toBeUndefined();
    });

    it('should return active context during execution', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {
        expect(getActiveSSRContext()).toBe(ctx);
      });
    });
  });

  describe('registerIsland', () => {
    it('should register island with unique ID', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {
        const id = registerIsland('counter', { initialCount: 5 }, STATUS_ELEMENT);
        expect(id).toBe('counter-0');
        expect(ctx.islands).toHaveLength(1);
        expect(ctx.islands[0]).toEqual({
          id: 'counter-0',
          type: 'counter',
          props: { initialCount: 5 },
          status: STATUS_ELEMENT,
        });
      });
    });

    it('should increment counter for each island', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {
        const id1 = registerIsland('counter', { count: 1 }, STATUS_ELEMENT);
        const id2 = registerIsland('counter', { count: 2 }, STATUS_ELEMENT);
        const id3 = registerIsland('form', {}, STATUS_FRAGMENT);

        expect(id1).toBe('counter-0');
        expect(id2).toBe('counter-1');
        expect(id3).toBe('form-2');
        expect(ctx.islandCounter).toBe(3);
      });
    });

    it('should throw outside SSR context', () => {
      expect(() => {
        registerIsland('counter', {}, STATUS_ELEMENT);
      }).toThrow('Cannot register island "counter" outside of SSR context');
    });

    it('should provide helpful error message', () => {
      expect(() => {
        registerIsland('counter', {}, STATUS_ELEMENT);
      }).toThrow('Did you forget to wrap your render in runWithSSRContext()?');
    });
  });

  describe('getIslandScripts', () => {
    it('should return empty string for no islands', () => {
      const ctx = createSSRContext();
      const scripts = getIslandScripts(ctx);
      expect(scripts).toBe('');
    });

    it('should generate script for single island', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {
        registerIsland('counter', { initialCount: 5 }, STATUS_ELEMENT);
      });

      const scripts = getIslandScripts(ctx);
      // Should include bootstrap script
      expect(scripts).toContain('window.__islands = [];');
      expect(scripts).toContain('window.__hydrate = (id, type, props, status)');
      // Should include island hydration call
      expect(scripts).toContain(
        `window.__hydrate("counter-0","counter",{"initialCount":5},${STATUS_ELEMENT})`
      );
    });

    it('should generate scripts for multiple islands', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {
        registerIsland('counter', { count: 1 }, STATUS_ELEMENT);
        registerIsland('form', { fields: [] }, STATUS_FRAGMENT);
      });

      const scripts = getIslandScripts(ctx);
      // Bootstrap + 2 island scripts
      expect(scripts).toContain('window.__islands = [];');
      expect(scripts).toContain('counter-0');
      expect(scripts).toContain('form-1');
    });

    it('should escape < and > in props JSON', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {
        registerIsland('xss', { html: '<script>alert("xss")</script>' }, STATUS_ELEMENT);
      });

      const scripts = getIslandScripts(ctx);
      expect(scripts).toContain('\\u003cscript\\u003e');
      expect(scripts).not.toContain('<script>alert');
    });

    it('should handle complex props', () => {
      const ctx = createSSRContext();
      runWithSSRContext(ctx, () => {
        registerIsland('complex', {
          array: [1, 2, 3],
          nested: { foo: 'bar' },
          bool: true,
          num: 42,
          str: 'hello',
        }, STATUS_ELEMENT);
      });

      const scripts = getIslandScripts(ctx);
      expect(scripts).toContain('"array":[1,2,3]');
      expect(scripts).toContain('"nested":{"foo":"bar"}');
    });
  });

  describe('SSR safety - request isolation', () => {
    it('should not leak state between requests', async () => {
      // Simulate two concurrent requests
      const request1 = () => {
        const ctx = createSSRContext();
        return runWithSSRContext(ctx, () => {
          registerIsland('counter', { userId: 1 }, STATUS_ELEMENT);
          return ctx;
        });
      };

      const request2 = () => {
        const ctx = createSSRContext();
        return runWithSSRContext(ctx, () => {
          registerIsland('counter', { userId: 2 }, STATUS_ELEMENT);
          return ctx;
        });
      };

      const [ctx1, ctx2] = await Promise.all([request1(), request2()]);

      expect(ctx1.islands).toHaveLength(1);
      expect(ctx1.islands[0]?.props).toEqual({ userId: 1 });

      expect(ctx2.islands).toHaveLength(1);
      expect(ctx2.islands[0]?.props).toEqual({ userId: 2 });
    });
  });
});
