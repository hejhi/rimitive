import { describe, it, expect } from 'vitest';
import { island } from './island';
import { createSSRContext, runWithSSRContext } from './ssr-context';
import { ISLAND_META } from './types';
import type { RefSpec } from '@lattice/view/types';

// Mock component factory
function mockComponent<TProps>() {
  return (props: TProps): RefSpec<unknown> => {
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
    it('should register island in SSR context', () => {
      const ctx = createSSRContext();
      const Counter = island('counter', mockComponent<{ count: number }>());

      runWithSSRContext(ctx, () => {
        Counter({ count: 5 });
      });

      expect(ctx.islands).toHaveLength(1);
      expect(ctx.islands[0]).toEqual({
        id: 'counter-0',
        type: 'counter',
        props: { count: 5 },
      });
    });

    it('should tag nodeRef with island ID', () => {
      const ctx = createSSRContext();
      const Counter = island('counter', mockComponent<{ count: number }>());

      const nodeRef = runWithSSRContext(ctx, () => {
        const spec = Counter({ count: 5 });
        return spec.create();
      });

      expect(nodeRef.__islandId).toBe('counter-0');
    });

    it('should generate unique IDs for multiple islands', () => {
      const ctx = createSSRContext();
      const Counter = island('counter', mockComponent<{ count: number }>());
      const Form = island('form', mockComponent<{ fields: string[] }>());

      runWithSSRContext(ctx, () => {
        Counter({ count: 1 });
        Counter({ count: 2 });
        Form({ fields: [] });
      });

      expect(ctx.islands).toHaveLength(3);
      expect(ctx.islands[0]?.id).toBe('counter-0');
      expect(ctx.islands[1]?.id).toBe('counter-1');
      expect(ctx.islands[2]?.id).toBe('form-2');
    });

    it('should not register outside SSR context', () => {
      const Counter = island('counter', mockComponent<{ count: number }>());

      // No SSR context - should not throw
      expect(() => Counter({ count: 5 })).not.toThrow();
    });

    it('should not tag nodeRef outside SSR context', () => {
      const Counter = island('counter', mockComponent<{ count: number }>());

      const spec = Counter({ count: 5 });
      const nodeRef = spec.create();

      expect(nodeRef.__islandId).toBeUndefined();
    });
  });

  describe('Component passthrough', () => {
    it('should call underlying component with props', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let receivedProps: any;
      const component = (props: { value: number }) => {
        receivedProps = props;
        return mockComponent<{ value: number }>()(props);
      };

      const Island = island('test', component);
      Island({ value: 42 });

      expect(receivedProps).toEqual({ value: 42 });
    });

    it('should return spec from underlying component', () => {
      const expectedSpec = {
        status: 4,
        create: () => ({}),
      } as RefSpec<unknown>;
      const component = () => expectedSpec;

      const Island = island('test', component);
      const result = Island({ value: 1 });

      expect(result).toBe(expectedSpec);
    });
  });

  describe('Multiple islands of same type', () => {
    it('should track each instance separately', () => {
      const ctx = createSSRContext();
      const Counter = island('counter', mockComponent<{ count: number }>());

      runWithSSRContext(ctx, () => {
        const spec1 = Counter({ count: 1 });
        const spec2 = Counter({ count: 2 });
        const spec3 = Counter({ count: 3 });

        const ref1 = spec1.create();
        const ref2 = spec2.create();
        const ref3 = spec3.create();

        expect(ref1.__islandId).toBe('counter-0');
        expect(ref2.__islandId).toBe('counter-1');
        expect(ref3.__islandId).toBe('counter-2');
      });

      expect(ctx.islands).toHaveLength(3);
      expect(ctx.islands.map((i) => i.props)).toEqual([
        { count: 1 },
        { count: 2 },
        { count: 3 },
      ]);
    });
  });
});
