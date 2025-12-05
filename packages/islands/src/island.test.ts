import { describe, it, expect } from 'vitest';
import { island } from './island';
import { createSSRContext, runWithSSRContext } from './ssr-context';
import { ISLAND_META } from './types';
import type { RefSpec } from '@lattice/view/types';

// Mock component factory - now returns factory function (svc) => (props) => RefSpec
function mockComponent<TProps>() {
  return () =>
    (props: TProps): RefSpec<unknown> => {
      const nodeRef = {
        status: 8, // STATUS_SEALED_SPEC
        element: { tag: 'div', props },
      };

      return {
        status: 4,
        create: () => nodeRef,
      } as RefSpec<unknown>;
    };
}

describe('Island Wrapper', () => {
  describe('island() basic functionality', () => {
    it('should create island component', () => {
      const Counter = island('counter', mockComponent<{ count: number }>());
      expect(typeof Counter).toBe('function');
    });

    it('should attach island metadata', () => {
      const Counter = island('counter', mockComponent<{ count: number }>());
      const meta = Counter[ISLAND_META];

      expect(meta).toBeDefined();
      expect(meta!.id).toBe('counter');
    });

    it('should attach strategy when provided', () => {
      const strategy = { onMismatch: () => {} };
      const Counter = island(
        'counter',
        strategy,
        mockComponent<{ count: number }>()
      );
      const meta = Counter[ISLAND_META];

      expect(meta!.strategy).toBe(strategy);
    });

    it('should work without strategy', () => {
      const Counter = island('counter', mockComponent<{ count: number }>());
      const meta = Counter[ISLAND_META];

      expect(meta!.strategy).toBeUndefined();
    });
  });

  describe('Props handling', () => {
    it('should accept serializable props', () => {
      const Counter = island('counter', mockComponent<{ count: number }>());

      expect(() => Counter({ count: 5 })).not.toThrow();
    });

    it('should accept complex nested props', () => {
      const Complex = island('complex', mockComponent());

      expect(() =>
        Complex({
          string: 'hello',
          number: 42,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          nested: {
            level2: {
              level3: { value: 'deep' },
            },
          },
        })
      ).not.toThrow();
    });
  });

  describe('SSR context integration', () => {
    // Note: Registration now happens lazily during decoration, not during create().
    // These tests verify that __islandMeta is set correctly for the decorator to use.

    it('should tag nodeRef with island metadata in SSR context', () => {
      const ctx = createSSRContext();
      const Counter = island('counter', mockComponent<{ count: number }>());

      const nodeRef = runWithSSRContext(ctx, () => {
        const spec = Counter({ count: 5 });
        return spec.create();
      });

      // __islandMeta is set during create() for lazy registration by decorator
      expect(nodeRef.__islandMeta).toBeDefined();
      expect(nodeRef.__islandMeta).toEqual({
        type: 'counter',
        props: { count: 5 },
      });
    });

    it('should not register until decorated (lazy registration)', () => {
      const ctx = createSSRContext();
      const Counter = island('counter', mockComponent<{ count: number }>());

      runWithSSRContext(ctx, () => {
        const spec = Counter({ count: 5 });
        spec.create();
      });

      // Registration happens during decoration, not create()
      // ctx.islands should be empty until decorator calls registerIsland
      expect(ctx.islands).toHaveLength(0);
    });

    it('should set metadata for multiple islands', () => {
      const ctx = createSSRContext();
      const Counter = island('counter', mockComponent<{ count: number }>());
      const Form = island('form', mockComponent<{ fields: string[] }>());

      const [ref1, ref2, ref3] = runWithSSRContext(ctx, () => {
        return [
          Counter({ count: 1 }).create(),
          Counter({ count: 2 }).create(),
          Form({ fields: [] }).create(),
        ] as const;
      });

      // Each ref has metadata for lazy registration
      expect(ref1.__islandMeta).toEqual({
        type: 'counter',
        props: { count: 1 },
      });
      expect(ref2.__islandMeta).toEqual({
        type: 'counter',
        props: { count: 2 },
      });
      expect(ref3.__islandMeta).toEqual({
        type: 'form',
        props: { fields: [] },
      });
    });

    it('should not throw outside SSR context', () => {
      const Counter = island('counter', mockComponent<{ count: number }>());

      // No SSR context - should not throw
      expect(() => Counter({ count: 5 })).not.toThrow();
    });

    it('should not tag nodeRef outside SSR context', () => {
      const Counter = island('counter', mockComponent<{ count: number }>());

      const spec = Counter({ count: 5 });
      const nodeRef = spec.create();

      expect(nodeRef.__islandMeta).toBeUndefined();
    });
  });

  describe('Component passthrough', () => {
    it('should call underlying component with props', () => {
      let receivedProps: { value: number } | undefined;
      const componentFactory = () => (props: { value: number }) => {
        receivedProps = props;
        return mockComponent<{ value: number }>()()(props);
      };

      const Island = island('test', componentFactory);
      const spec = Island({ value: 42 });
      spec.create();

      expect(receivedProps).toEqual({ value: 42 });
    });

    it('should call factory with svc during create', () => {
      let receivedSvc: unknown;
      const componentFactory = (svc: unknown) => {
        receivedSvc = svc;
        return (props: { value: number }) =>
          mockComponent<{ value: number }>()()(props);
      };

      const mockSvc = { el: 'mock' };
      const Island = island('test', componentFactory);
      const spec = Island({ value: 1 });
      spec.create(mockSvc);

      expect(receivedSvc).toBe(mockSvc);
    });
  });

  describe('Multiple islands of same type', () => {
    it('should set metadata for each instance separately', () => {
      const ctx = createSSRContext();
      const Counter = island('counter', mockComponent<{ count: number }>());

      runWithSSRContext(ctx, () => {
        const spec1 = Counter({ count: 1 });
        const spec2 = Counter({ count: 2 });
        const spec3 = Counter({ count: 3 });

        const ref1 = spec1.create();
        const ref2 = spec2.create();
        const ref3 = spec3.create();

        // Each instance has its own metadata for lazy registration
        expect(ref1.__islandMeta).toEqual({
          type: 'counter',
          props: { count: 1 },
        });
        expect(ref2.__islandMeta).toEqual({
          type: 'counter',
          props: { count: 2 },
        });
        expect(ref3.__islandMeta).toEqual({
          type: 'counter',
          props: { count: 3 },
        });

        // All refs have metadata
        expect(ref1.__islandMeta).toBeDefined();
        expect(ref2.__islandMeta).toBeDefined();
        expect(ref3.__islandMeta).toBeDefined();
      });

      // Registration happens during decoration, not create()
      expect(ctx.islands).toHaveLength(0);
    });
  });
});
