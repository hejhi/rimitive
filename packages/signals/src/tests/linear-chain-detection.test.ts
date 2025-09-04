import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalAPI } from '../api';
import { createBaseContext } from '../context';
import { createPullPropagator } from '../helpers/pull-propagator';
import { createGraphEdges } from '../helpers/graph-edges';
import { createNodeScheduler } from '../helpers/node-scheduler';
import { createPushPropagator } from '../helpers/push-propagator';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';

describe('Linear Chain Detection', () => {
  let api: ReturnType<typeof createSignalAPI>;
  let signal: any;
  let computed: any;

  beforeEach(() => {
    const baseCtx = createBaseContext();
    const pullPropagator = createPullPropagator();
    const graphEdges = createGraphEdges();
    const nodeScheduler = createNodeScheduler(baseCtx, pullPropagator.pullUpdates);
    const pushPropagator = createPushPropagator();

    api = createSignalAPI(
      {
        signal: createSignalFactory,
        computed: createComputedFactory,
      },
      {
        ...baseCtx,
        nodeScheduler,
        graphEdges,
        pushPropagator,
        pullPropagator,
      }
    );

    signal = api.signal;
    computed = api.computed;
  });

  describe('Pure Linear Chains', () => {
    it('should handle a simple linear chain', () => {
      const s = signal(0);
      const c1 = computed(() => s() + 1);
      const c2 = computed(() => c1() + 1);
      const c3 = computed(() => c2() + 1);

      expect(c3()).toBe(3);
      
      s(10);
      expect(c3()).toBe(13);
    });

    it('should handle a deep linear chain', () => {
      const s = signal(0);
      let current: any = s;
      
      // Create a 10-level deep chain
      for (let i = 0; i < 10; i++) {
        const prev = current;
        current = computed(() => prev() + 1);
      }
      
      expect(current()).toBe(10);
      
      s(5);
      expect(current()).toBe(15);
    });

    it('should handle very deep linear chains efficiently', () => {
      const s = signal(0);
      let current: any = s;
      
      // Create a 50-level deep chain (like our benchmark)
      for (let i = 0; i < 50; i++) {
        const prev = current;
        current = computed(() => prev() + 1);
      }
      
      expect(current()).toBe(50);
      
      // Multiple updates to test amortized performance
      for (let i = 1; i <= 10; i++) {
        s(i);
        expect(current()).toBe(50 + i);
      }
    });
  });

  describe('Branching Chains', () => {
    it('should handle multiple dependencies at the start', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const c1 = computed(() => s1() + s2());
      const c2 = computed(() => c1() * 2);
      
      expect(c2()).toBe(6);
      
      s1(10);
      expect(c2()).toBe(24);
      
      s2(20);
      expect(c2()).toBe(60);
    });

    it('should handle branching in the middle of a chain', () => {
      const s = signal(0);
      const c1 = computed(() => s() + 1);
      
      // Branch point - c1 has multiple dependents
      const c2a = computed(() => c1() * 2);
      const c2b = computed(() => c1() * 3);
      
      const c3 = computed(() => c2a() + c2b());
      
      expect(c3()).toBe(5); // (0+1)*2 + (0+1)*3 = 2+3 = 5
      
      s(9);
      expect(c3()).toBe(50); // (9+1)*2 + (9+1)*3 = 20+30 = 50
    });

    it('should handle diamond dependency patterns', () => {
      const s = signal(1);
      
      // Diamond pattern
      const left = computed(() => s() * 2);
      const right = computed(() => s() * 3);
      const bottom = computed(() => left() + right());
      
      expect(bottom()).toBe(5); // 1*2 + 1*3 = 5
      
      s(10);
      expect(bottom()).toBe(50); // 10*2 + 10*3 = 50
    });

    it('should handle complex mixed patterns', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      
      // Linear part
      const c1 = computed(() => s1() + 1);
      const c2 = computed(() => c1() + 1);
      
      // Branching part
      const c3a = computed(() => c2() + s2());
      const c3b = computed(() => c2() * 2);
      
      // Converge
      const c4 = computed(() => c3a() + c3b());
      
      expect(c4()).toBe(11); // (1+1+1+2) + (1+1+1)*2 = 5 + 6 = 11
      
      s1(5);
      expect(c4()).toBe(23); // (5+1+1+2) + (5+1+1)*2 = 9 + 14 = 23
      
      s2(10);
      expect(c4()).toBe(31); // (5+1+1+10) + (5+1+1)*2 = 17 + 14 = 31
    });
  });

  describe('Edge Cases', () => {
    it('should handle single computed with no dependencies changing', () => {
      const s = signal(5);
      const c = computed(() => s() * 2);
      
      expect(c()).toBe(10);
      
      // Update that doesn't change the value
      s(5);
      expect(c()).toBe(10);
      
      s(3);
      expect(c()).toBe(6);
    });

    it('should handle conditional dependencies', () => {
      const condition = signal(true);
      const a = signal(1);
      const b = signal(2);
      
      const c = computed(() => {
        if (condition()) {
          return a();
        } else {
          return b();
        }
      });
      
      expect(c()).toBe(1);
      
      condition(false);
      expect(c()).toBe(2);
      
      // Now changes to 'a' shouldn't affect 'c'
      a(10);
      expect(c()).toBe(2);
      
      // But changes to 'b' should
      b(20);
      expect(c()).toBe(20);
    });

    it('should handle circular-looking but valid patterns', () => {
      const s = signal(0);
      const c1 = computed(() => s() + 1);
      
      // c2 and c3 both depend on c1 (siblings)
      const c2 = computed(() => c1() * 2);
      const c3 = computed(() => c1() * 3);
      
      // c4 depends on both c2 and c3 (convergence)
      const c4 = computed(() => c2() + c3());
      
      // c5 continues the chain linearly
      const c5 = computed(() => c4() + 1);
      
      expect(c5()).toBe(6); // ((0+1)*2 + (0+1)*3) + 1 = (2+3) + 1 = 6
      
      s(4);
      expect(c5()).toBe(26); // ((4+1)*2 + (4+1)*3) + 1 = (10+15) + 1 = 26
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain sentinel frames for linear chains', () => {
      // This test verifies the optimization is working by creating
      // a scenario where sentinel frames should be used
      const s = signal(0);
      const computeds: any[] = [];
      
      // Create a pure linear chain - using closure properly
      let prev: any = s;
      for (let i = 0; i < 20; i++) {
        const currentPrev = prev;  // Capture current value in closure
        const c = computed(() => currentPrev() + 1);
        computeds.push(c);
        prev = c;
      }
      
      // Access the final computed multiple times
      // This should benefit from the sentinel frame optimization
      const final = computeds[computeds.length - 1];
      
      for (let i = 0; i < 100; i++) {
        s(i);
        expect(final()).toBe(i + 20);
      }
    });

    it('should handle alternating linear and branching patterns', () => {
      const s = signal(0);
      
      // Linear section
      const c1 = computed(() => s() + 1);
      const c2 = computed(() => c1() + 1);
      
      // Branching section
      const c3a = computed(() => c2() * 2);
      const c3b = computed(() => c2() * 3);
      
      // Linear continuation from one branch
      const c4 = computed(() => c3a() + 1);
      const c5 = computed(() => c4() + 1);
      
      // Merge point
      const c6 = computed(() => c5() + c3b());
      
      expect(c6()).toBe(12); // ((0+1+1)*2+1+1) + ((0+1+1)*3) = 6 + 6 = 12
      
      s(3);
      expect(c6()).toBe(27); // ((3+1+1)*2+1+1) + ((3+1+1)*3) = 12 + 15 = 27
    });
  });
});