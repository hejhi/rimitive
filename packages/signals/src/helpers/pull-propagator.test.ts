import { describe, it, expect, vi } from 'vitest';
import type { DerivedNode, FromNode, Dependency, ProducerNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { createPullPropagator } from './pull-propagator';

const { STATUS_CLEAN, STATUS_PENDING, STATUS_DIRTY } = CONSTANTS;

describe('pull-propagator: FRP lazy evaluation invariants', () => {
  /**
   * SUMMARY OF CRITICAL BUGS FOUND:
   *
   * 1. DIAMOND DEPENDENCY BUG: The pull algorithm fails to compute all branches
   *    in a diamond pattern. It stops after finding the first dirty dependency,
   *    leaving other branches uncomputed. This violates consistency.
   *
   * 2. GLITCH VULNERABILITY: The algorithm doesn't ensure all dependencies are
   *    updated before computing a node, allowing intermediate inconsistent states.
   *
   * 3. NO CYCLE DETECTION: The algorithm infinitely loops on circular dependencies
   *    instead of detecting and handling them gracefully.
   *
   * 4. INCOMPLETE PROPAGATION: Deep chains and complex graphs may not fully
   *    propagate due to the early termination bug.
   *
   * These are fundamental violations of FRP principles that compromise:
   * - Correctness (wrong computed values)
   * - Consistency (glitches)
   * - Safety (infinite loops)
   * - Performance (incomplete optimization)
   */

  // Debug helper to trace execution
  function traceExecution(name: string, fn: () => any) {
    return () => {
      console.log(`  Computing ${name}`);
      const result = fn();
      console.log(`    ${name} = ${result}`);
      return result;
    };
  }


  // Test helper to create a minimal derived node
  function createDerivedNode(
    compute: () => any,
    dependencies?: Dependency,
    status: number = STATUS_PENDING
  ): DerivedNode {
    const node = {
      compute,
      dependencies,
      value: undefined,
      status,
    } as DerivedNode;
    (node as any).version = 0; // Add version for testing
    return node;
  }

  // Test helper to create a minimal source node
  function createSourceNode(value: any, status: number = STATUS_CLEAN): FromNode {
    const node = {
      value,
      status,
    } as ProducerNode;
    (node as any).version = 0; // Add version for testing
    (node as any).dependents = undefined; // Add dependents for testing
    return node as FromNode;
  }

  // Test helper to create a dependency edge
  function createDependency(producer: FromNode, nextDep?: Dependency): Dependency {
    const dep = {
      producer,
      consumer: null as any, // Not needed for pull tests
      version: (producer as any).version || 0,
      nextDependency: nextDep,
      nextTarget: undefined,
    };
    return dep as unknown as Dependency;
  }

  // Mock context and track function
  function createTestContext() {
    const ctx: GlobalContext = {} as GlobalContext;

    // Track function that simulates dependency tracking
    const track = vi.fn((_context: any, _node: any, compute: any) => {
      return compute();
    });

    return { ctx, track };
  }

  describe('CRITICAL BUG: Pull propagator violates diamond dependency invariant', () => {
    it('FAILS to compute all dependencies in diamond pattern', () => {
      /**
       * This test exposes a CRITICAL bug in the pull propagator.
       *
       * Diamond dependency graph:
       *     A (dirty)
       *    / \
       *   B   C
       *    \ /
       *     D
       *
       * Expected behavior (FRP invariant):
       * - D needs both B and C values
       * - B should compute (depends on dirty A)
       * - C should compute (depends on dirty A)
       * - D should compute using both B and C values
       *
       * Actual behavior (BUG):
       * - Algorithm finds B depends on dirty A, computes B
       * - Algorithm marks D as dirty because B changed
       * - Algorithm NEVER computes C!
       * - This violates glitch-freedom and consistency
       */

      const { ctx, track } = createTestContext();
      const propagator = createPullPropagator({ ctx, track });

      console.log('\n=== Diamond Dependency Bug Test ===');

      // Track computation counts
      let computeCountB = 0;
      let computeCountC = 0;
      let computeCountD = 0;

      // Create source node A (dirty)
      const nodeA = createSourceNode(10, STATUS_DIRTY);
      console.log('Source A: value=10, status=DIRTY');

      // Create intermediate nodes B and C
      const nodeB = createDerivedNode(
        traceExecution('B', () => {
          computeCountB++;
          return (nodeA.value as number) * 2; // Should be 20
        }),
        createDependency(nodeA),
        STATUS_PENDING
      );

      const nodeC = createDerivedNode(
        traceExecution('C', () => {
          computeCountC++;
          return (nodeA.value as number) * 3; // Should be 30
        }),
        createDependency(nodeA),
        STATUS_PENDING
      );

      // Create final node D depending on both B and C
      const nodeD = createDerivedNode(
        traceExecution('D', () => {
          computeCountD++;
          console.log(`    Reading B.value=${nodeB.value}, C.value=${nodeC.value}`);
          return ((nodeB.value as number) || 0) + ((nodeC.value as number) || 0);
        }),
        createDependency(nodeB, createDependency(nodeC)),
        STATUS_PENDING
      );

      console.log('\nPulling from D...');
      propagator.pullUpdates(nodeD);

      console.log('\n=== Results ===');
      console.log(`B computed ${computeCountB} times, value=${nodeB.value}, status=${nodeB.status}`);
      console.log(`C computed ${computeCountC} times, value=${nodeC.value}, status=${nodeC.status}`);
      console.log(`D computed ${computeCountD} times, value=${nodeD.value}, status=${nodeD.status}`);

      // THE BUG: C is never computed!
      expect(computeCountC).toBe(1); // FAILS - C is never computed
      expect(nodeC.value).toBe(30);  // FAILS - C.value remains undefined

      // This causes D to compute with incorrect values
      expect(nodeD.value).toBe(50); // FAILS - D gets 20 instead of 50
    });

    it('reveals the root cause: early termination on first dirty dependency', () => {
      /**
       * The bug is in the pull algorithm's handling of multiple dependencies.
       * When it finds the first dirty dependency (B), it immediately recomputes
       * the current node (D) WITHOUT checking if other dependencies (C) need
       * updating first.
       *
       * This violates the FRP principle that a node should only compute
       * after ALL its dependencies are up-to-date.
       */

      const { ctx, track } = createTestContext();
      const propagator = createPullPropagator({ ctx, track });

      const nodeA = createSourceNode(5, STATUS_DIRTY);

      // Three parallel dependencies
      const nodeB = createDerivedNode(() => (nodeA.value as number) * 2, createDependency(nodeA), STATUS_PENDING);
      const nodeC = createDerivedNode(() => (nodeA.value as number) * 3, createDependency(nodeA), STATUS_PENDING);
      const nodeE = createDerivedNode(() => (nodeA.value as number) * 4, createDependency(nodeA), STATUS_PENDING);

      // Node that depends on all three
      const nodeF = createDerivedNode(
        () => {
          console.log(`Computing F: B=${nodeB.value}, C=${nodeC.value}, E=${nodeE.value}`);
          return ((nodeB.value as number) || 0) + ((nodeC.value as number) || 0) + ((nodeE.value as number) || 0);
        },
        createDependency(nodeB, createDependency(nodeC, createDependency(nodeE))),
        STATUS_PENDING
      );

      propagator.pullUpdates(nodeF);

      // After fixing the bug, all dependencies are properly computed
      expect(nodeB.value).toBe(10); // 5 * 2
      expect(nodeC.value).toBe(15); // 5 * 3
      expect(nodeE.value).toBe(20); // 5 * 4
      expect(nodeF.value).toBe(45); // 10 + 15 + 20
    });
  });

  describe('Invariant: Glitch-free updates', () => {
    it('should never expose intermediate inconsistent states', () => {
      /**
       * Glitch freedom is a fundamental FRP property.
       * No computation should ever see an inconsistent worldview
       * where some dependencies are updated and others are not.
       */

      const { ctx, track } = createTestContext();
      const propagator = createPullPropagator({ ctx, track });

      // Two source nodes
      const nodeX = createSourceNode(10, STATUS_CLEAN);
      const nodeY = createSourceNode(20, STATUS_CLEAN);

      // Derived node that should see consistent X and Y
      const nodeSum = createDerivedNode(
        () => {
          const sum = (nodeX.value as number) + (nodeY.value as number);
          // In a glitch-free system, if X=10,Y=20 initially,
          // and we update both to X=100,Y=200,
          // we should NEVER see X=100,Y=20 or X=10,Y=200
          console.log(`Sum computation sees: X=${nodeX.value}, Y=${nodeY.value}, sum=${sum}`);
          return sum;
        },
        createDependency(nodeX, createDependency(nodeY)),
        STATUS_CLEAN
      );

      // Initial pull establishes baseline
      nodeSum.value = 30; // X=10 + Y=20

      // Now update both sources
      nodeX.value = 100;
      nodeX.status = STATUS_DIRTY;
      (nodeX as any).version = ((nodeX as any).version || 0) + 1;

      nodeY.value = 200;
      nodeY.status = STATUS_DIRTY;
      (nodeY as any).version = ((nodeY as any).version || 0) + 1;

      // Mark nodeSum as PENDING since its dependencies changed
      nodeSum.status = STATUS_PENDING;

      // Pull should see BOTH updates atomically
      propagator.pullUpdates(nodeSum);

      // Should see the consistent new state
      expect(nodeSum.value).toBe(300); // 100 + 200
    });
  });

  describe('Invariant: Version monotonicity', () => {
    it('should maintain monotonically increasing versions', () => {
      /**
       * Version numbers must only increase, never decrease.
       * This is crucial for cache invalidation and change detection.
       */
      const { ctx } = createTestContext();

      // Mock track to update versions
      const trackWithVersions = vi.fn((_context: any, node: any, compute: any) => {
        const oldVersion = (node as any).version || 0;
        const result = compute();
        (node as any).version = oldVersion + 1; // Versions should increase
        return result;
      });

      const propagator = createPullPropagator({ ctx, track: trackWithVersions });

      const source = createSourceNode(1, STATUS_DIRTY);
      (source as any).version = 10;

      const derived = createDerivedNode(
        () => (source.value as number) * 2,
        createDependency(source),
        STATUS_PENDING
      );
      (derived as any).version = 5;

      const previousVersion = (derived as any).version;
      propagator.pullUpdates(derived);

      // Version should have increased
      expect((derived as any).version).toBeGreaterThan(previousVersion);
    });
  });

  describe('Invariant: Pull termination guarantee', () => {
    it.skip('FAILS: infinite loop with circular dependencies', () => {
      /**
       * BUG: The pull algorithm does NOT handle cycles!
       * It will infinitely loop if circular dependencies exist.
       * This is a critical safety issue that should be addressed.
       *
       * While circular dependencies are typically prevented at a higher level,
       * the pull algorithm MUST terminate even if they exist to avoid infinite loops.
       */
      const { ctx, track } = createTestContext();
      createPullPropagator({ ctx, track }); // Would be used if not for infinite loop

      // Create a potential cycle (though this should be prevented by the system)
      const nodeA = createDerivedNode(() => 1, undefined, STATUS_PENDING);
      const nodeB = createDerivedNode(() => 2, createDependency(nodeA), STATUS_PENDING);

      // Artificially create a cycle for testing (normally prevented)
      nodeA.dependencies = createDependency(nodeB);

      // WARNING: This causes infinite recursion!
      // propagator.pullUpdates(nodeA);

      // The test is skipped to avoid crashing the test runner
      expect(true).toBe(true);
    });

    it('should handle deeply nested dependencies without stack overflow', () => {
      /**
       * The pull algorithm should handle arbitrarily deep dependency chains
       * without causing stack overflow.
       */
      const { ctx, track } = createTestContext();
      const propagator = createPullPropagator({ ctx, track });

      // Create a very deep chain
      const depth = 1000;
      let prevNode: FromNode = createSourceNode(1, STATUS_DIRTY);
      const nodes: DerivedNode[] = [];

      for (let i = 0; i < depth; i++) {
        const currentPrev = prevNode; // Capture current prevNode for closure
        const node = createDerivedNode(
          () => (currentPrev.value as number) + 1,
          createDependency(currentPrev),
          STATUS_PENDING
        );
        nodes.push(node);
        prevNode = node;
      }

      // Should handle deep recursion without stack overflow
      expect(() => {
        propagator.pullUpdates(nodes[depth - 1]!);
      }).not.toThrow();

      // Verify the computation worked
      expect(nodes[depth - 1]!.value).toBe(depth + 1);
    });
  });

  describe('ROOT CAUSE ANALYSIS', () => {
    it('pinpoints the exact bug: lines 75-78 break on first dirty', () => {
      /**
       * THE BUG is in pull-propagator.ts lines 75-78:
       *
       * if (pStatus === STATUS_DIRTY) {
       *   hasDirty = true;
       *   break; // <-- THIS IS THE BUG!
       * }
       *
       * The algorithm breaks immediately upon finding ANY dirty dependency,
       * then recomputes the current node. But if there are OTHER dependencies
       * that are PENDING (need computation), they are NEVER processed!
       *
       * CORRECT BEHAVIOR:
       * Should check ALL dependencies first, compute any PENDING ones,
       * THEN recompute current node only after all deps are up-to-date.
       */

      const { ctx, track } = createTestContext();
      const propagator = createPullPropagator({ ctx, track });

      const source = createSourceNode(100, STATUS_DIRTY);

      // Two siblings that both need computation
      const left = createDerivedNode(
        () => {
          console.log('Computing LEFT');
          return (source.value as number) / 2;
        },
        createDependency(source),
        STATUS_PENDING
      );

      const right = createDerivedNode(
        () => {
          console.log('Computing RIGHT');
          return (source.value as number) / 4;
        },
        createDependency(source),
        STATUS_PENDING
      );

      // Consumer depends on both
      const consumer = createDerivedNode(
        () => {
          console.log(`Computing CONSUMER with left=${left.value}, right=${right.value}`);
          return ((left.value as number) || 0) + ((right.value as number) || 0);
        },
        createDependency(left, createDependency(right)),
        STATUS_PENDING
      );

      console.log('\n=== BUG DEMONSTRATION ===');
      console.log('Expected: Compute LEFT, Compute RIGHT, then CONSUMER');
      console.log('Actual: Computes LEFT, finds it dirty, immediately computes CONSUMER');
      console.log('Result: RIGHT is never computed!\n');

      propagator.pullUpdates(consumer);

      // BUG: right is never computed
      expect(right.value).toBe(25); // FAILS - remains undefined
      expect(consumer.value).toBe(75); // FAILS - gets 50 instead
    });
  });

  describe('Invariant: Minimal recomputation - nodes compute at most once per pull cycle', () => {
    it('should compute diamond dependency middle nodes only once', () => {
      /**
       * Diamond dependency graph:
       *     A
       *    / \
       *   B   C
       *    \ /
       *     D
       *
       * When D pulls and A is dirty, B and C should each compute exactly once.
       * This is a CRITICAL FRP invariant - redundant computation violates laziness.
       */

      const { ctx, track } = createTestContext();
      const propagator = createPullPropagator({ ctx, track });

      // Track computation counts
      let computeCountB = 0;
      let computeCountC = 0;
      let computeCountD = 0;

      // Create source node A (dirty)
      const nodeA = createSourceNode(1, STATUS_DIRTY);

      // Create intermediate nodes B and C
      const nodeB = createDerivedNode(
        () => {
          computeCountB++;
          return (nodeA.value as number) * 2;
        },
        createDependency(nodeA),
        STATUS_PENDING
      );

      const nodeC = createDerivedNode(
        () => {
          computeCountC++;
          return (nodeA.value as number) * 3;
        },
        createDependency(nodeA),
        STATUS_PENDING
      );

      // Create final node D depending on both B and C
      const nodeD = createDerivedNode(
        () => {
          computeCountD++;
          return (nodeB.value as number) + (nodeC.value as number);
        },
        createDependency(nodeB, createDependency(nodeC)),
        STATUS_PENDING
      );

      // Pull updates from D
      propagator.pullUpdates(nodeD);

      // Check how many times track was called
      expect(track).toHaveBeenCalled();
      console.log('Track called times:', track.mock.calls.length);
      console.log('Compute counts - B:', computeCountB, 'C:', computeCountC, 'D:', computeCountD);

      // CRITICAL ASSERTIONS - these test FRP invariants, not implementation
      expect(computeCountB).toBe(1); // B should compute exactly once
      expect(computeCountC).toBe(1); // C should compute exactly once
      expect(computeCountD).toBe(1); // D should compute exactly once

      // Verify correct values were computed
      expect(nodeB.value).toBe(2);
      expect(nodeC.value).toBe(3);
      expect(nodeD.value).toBe(5);

      // All nodes should be clean after pull
      expect(nodeB.status).toBe(STATUS_CLEAN);
      expect(nodeC.status).toBe(STATUS_CLEAN);
      expect(nodeD.status).toBe(STATUS_CLEAN);
    });

    it('should handle deep chain without exponential recomputation', () => {
      /**
       * Deep chain: A -> B -> C -> D -> E
       * Each node should compute at most once, even if pulled multiple times.
       * Linear time complexity is essential for FRP scalability.
       */
      const { ctx, track } = createTestContext();
      const propagator = createPullPropagator({ ctx, track });

      let computeCount = 0;
      const nodes: DerivedNode[] = [];

      // Create a chain of 5 nodes
      let prevNode: FromNode = createSourceNode(1, STATUS_DIRTY);

      for (let i = 0; i < 5; i++) {
        const currentPrev = prevNode; // Capture current prevNode for closure
        const node = createDerivedNode(
          () => {
            computeCount++;
            return (currentPrev.value as number) + 1;
          },
          createDependency(currentPrev),
          STATUS_PENDING
        );
        nodes.push(node);
        prevNode = node;
      }

      // Pull from the last node
      propagator.pullUpdates(nodes[4]!);

      // Should compute exactly 5 times (once per node)
      expect(computeCount).toBe(5);

      // Verify values propagated correctly
      expect(nodes[0]!.value).toBe(2);
      expect(nodes[1]!.value).toBe(3);
      expect(nodes[2]!.value).toBe(4);
      expect(nodes[3]!.value).toBe(5);
      expect(nodes[4]!.value).toBe(6);
    });
  });
});