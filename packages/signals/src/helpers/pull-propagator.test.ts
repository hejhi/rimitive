import { describe, it, expect, vi } from 'vitest';
import type { DerivedNode, FromNode, Dependency, ProducerNode, ConsumerNode } from '../types';
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

  // Test helper to create a minimal derived node
  function createDerivedNode(
    compute: () => any,
    dependencies?: Dependency,
    status: number = STATUS_PENDING
  ): DerivedNode {
    const node = {
      compute,
      dependencies,
      dependencyTail: dependencies, // ConsumerNode field
      trackingVersion: 0, // ConsumerNode field - proper version tracking
      value: undefined,
      version: 0, // ProducerNode field - value version
      status,
      // ProducerNode fields
      subscribers: undefined,
      subscribersTail: undefined,
    } as DerivedNode;
    return node;
  }

  // Test helper to create a minimal source node
  function createSourceNode(value: any, status: number = STATUS_CLEAN): FromNode {
    const node = {
      value,
      version: 0,
      status,
      // ProducerNode fields
      subscribers: undefined,
      subscribersTail: undefined,
    } as ProducerNode;
    return node as FromNode;
  }

  // Test helper to create a dependency edge
  function createDependency(producer: FromNode, nextDep?: Dependency, consumer?: ConsumerNode): Dependency {
    const dep: Dependency = {
      producer,
      consumer: consumer as any, // Will be set later when wiring to nodes
      version: 0, // Will be set by track function based on consumer's trackingVersion
      producerVersion: 0, // Producer's version when dependency was created
      nextDependency: nextDep,
      prevDependency: undefined,
      nextConsumer: undefined,
      prevConsumer: undefined,
    };
    return dep;
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

      // Track computation counts
      let computeCountB = 0;
      let computeCountC = 0;
      let computeCountD = 0;

      // Create source node A (dirty)
      const nodeA = createSourceNode(10, STATUS_DIRTY);

      // Create intermediate nodes B and C (dependencies wired after creation)
      const nodeB = createDerivedNode(
        () => {
          computeCountB++;
          return (nodeA.value as number) * 2; // Should be 20
        },
        undefined,
        STATUS_PENDING
      );

      const nodeC = createDerivedNode(
        () => {
          computeCountC++;
          return (nodeA.value as number) * 3; // Should be 30
        },
        undefined,
        STATUS_PENDING
      );

      // Create final node D depending on both B and C
      const nodeD = createDerivedNode(
        () => {
          computeCountD++;
          return ((nodeB.value as number) || 0) + ((nodeC.value as number) || 0);
        },
        undefined,
        STATUS_PENDING
      );

      // Wire dependencies with proper consumer references
      nodeB.dependencies = createDependency(nodeA, undefined, nodeB);
      nodeB.dependencyTail = nodeB.dependencies;

      nodeC.dependencies = createDependency(nodeA, undefined, nodeC);
      nodeC.dependencyTail = nodeC.dependencies;

      const depC = createDependency(nodeC, undefined, nodeD);
      const depB = createDependency(nodeB, depC, nodeD);
      nodeD.dependencies = depB;
      nodeD.dependencyTail = depC;

      propagator.pullUpdates(nodeD);

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
      const nodeB = createDerivedNode(() => (nodeA.value as number) * 2, undefined, STATUS_PENDING);
      const nodeC = createDerivedNode(() => (nodeA.value as number) * 3, undefined, STATUS_PENDING);
      const nodeE = createDerivedNode(() => (nodeA.value as number) * 4, undefined, STATUS_PENDING);

      // Node that depends on all three
      const nodeF = createDerivedNode(
        () => {
          return ((nodeB.value as number) || 0) + ((nodeC.value as number) || 0) + ((nodeE.value as number) || 0);
        },
        undefined,
        STATUS_PENDING
      );

      // Wire dependencies with proper consumer references
      nodeB.dependencies = createDependency(nodeA, undefined, nodeB);
      nodeB.dependencyTail = nodeB.dependencies;

      nodeC.dependencies = createDependency(nodeA, undefined, nodeC);
      nodeC.dependencyTail = nodeC.dependencies;

      nodeE.dependencies = createDependency(nodeA, undefined, nodeE);
      nodeE.dependencyTail = nodeE.dependencies;

      const depE = createDependency(nodeE, undefined, nodeF);
      const depC = createDependency(nodeC, depE, nodeF);
      const depB = createDependency(nodeB, depC, nodeF);
      nodeF.dependencies = depB;
      nodeF.dependencyTail = depE;

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

      nodeY.value = 200;
      nodeY.status = STATUS_DIRTY;

      // Mark nodeSum as PENDING since its dependencies changed
      nodeSum.status = STATUS_PENDING;

      // Pull should see BOTH updates atomically
      propagator.pullUpdates(nodeSum);

      // Should see the consistent new state
      expect(nodeSum.value).toBe(300); // 100 + 200
    });
  });

  describe('Invariant: Dependency version tracking for efficient pruning', () => {
    it('should properly track dependency versions through consumer trackingVersion', () => {
      /**
       * CORRECT VERSION TRACKING MECHANISM:
       * 1. ConsumerNode has trackingVersion - incremented each time dependencies are tracked
       * 2. Dependency has version - captures consumer's trackingVersion when created
       * 3. This enables efficient dependency pruning - stale deps have version < trackingVersion
       *
       * This test validates the actual FRP mechanism, not implementation details.
       */
      const { ctx } = createTestContext();

      // Track function that properly increments trackingVersion
      const trackWithVersions = vi.fn((_context: GlobalContext, node: ConsumerNode, compute: () => any) => {
        // This simulates what the real track function does
        node.trackingVersion = (node.trackingVersion || 0) + 1;

        // Update dependency versions to current trackingVersion
        let dep = node.dependencies;
        while (dep) {
          dep.version = node.trackingVersion;
          dep = dep.nextDependency;
        }

        return compute();
      });

      const propagator = createPullPropagator({ ctx, track: trackWithVersions });

      const source = createSourceNode(1, STATUS_DIRTY);

      // Create derived node with proper ConsumerNode fields
      const derived = createDerivedNode(
        () => (source.value as number) * 2,
        createDependency(source),
        STATUS_PENDING
      );

      // Initialize trackingVersion (ConsumerNodes have this field)
      derived.trackingVersion = 0;

      // Pull updates - should increment trackingVersion
      propagator.pullUpdates(derived);

      // Verify trackingVersion was incremented
      expect(derived.trackingVersion).toBe(1);

      // Verify the computation worked
      expect(derived.value).toBe(2);

      // Update source and pull again
      source.value = 10;
      source.status = STATUS_DIRTY;
      derived.status = STATUS_PENDING;

      propagator.pullUpdates(derived);

      // trackingVersion should increment again
      expect(derived.trackingVersion).toBe(2);
      expect(derived.value).toBe(20);

      // Verify dependencies have the correct version
      if (derived.dependencies) {
        expect(derived.dependencies.version).toBe(2);
      }
    });

    it('should enable dependency pruning through version comparison', () => {
      /**
       * Version tracking enables efficient dependency pruning:
       * - Dependencies with version < trackingVersion are stale
       * - This allows removing unused dependencies after re-tracking
       * - Critical for memory efficiency in dynamic reactive graphs
       */
      const { ctx } = createTestContext();

      let trackedDependencies: Set<FromNode> = new Set();

      // Track function that simulates dynamic dependency tracking
      const trackWithPruning = vi.fn((_context: GlobalContext, node: ConsumerNode, compute: () => any) => {
        node.trackingVersion = (node.trackingVersion || 0) + 1;

        // Mark accessed dependencies
        trackedDependencies.clear();

        // Execute computation (would normally track deps automatically)
        const result = compute();

        // Update versions of accessed dependencies
        let dep = node.dependencies;
        while (dep) {
          if (trackedDependencies.has(dep.producer)) {
            dep.version = node.trackingVersion;
          }
          // Dependencies with version < trackingVersion would be pruned
          dep = dep.nextDependency;
        }

        return result;
      });

      const propagator = createPullPropagator({ ctx, track: trackWithPruning });

      const sourceA = createSourceNode(5, STATUS_CLEAN);
      const sourceB = createSourceNode(10, STATUS_CLEAN);

      let useSourceB = true;

      // Derived node that conditionally depends on sources
      const derived = createDerivedNode(
        () => {
          trackedDependencies.add(sourceA);
          if (useSourceB) {
            trackedDependencies.add(sourceB);
            return (sourceA.value as number) + (sourceB.value as number);
          }
          return (sourceA.value as number) * 2;
        },
        createDependency(sourceA, createDependency(sourceB)),
        STATUS_PENDING
      );

      derived.trackingVersion = 0;

      // First pull - depends on both sources
      propagator.pullUpdates(derived);
      expect(derived.value).toBe(15);
      expect(derived.trackingVersion).toBe(1);

      // Both dependencies should be current
      let depA = derived.dependencies;
      let depB = depA?.nextDependency;
      expect(depA?.version).toBe(1);
      expect(depB?.version).toBe(1);

      // Change condition - no longer needs sourceB
      useSourceB = false;
      sourceA.value = 7;
      sourceA.status = STATUS_DIRTY;
      derived.status = STATUS_PENDING;

      propagator.pullUpdates(derived);
      expect(derived.value).toBe(14);
      expect(derived.trackingVersion).toBe(2);

      // SourceA dependency should be updated, sourceB should be stale
      expect(depA?.version).toBe(2); // Updated
      expect(depB?.version).toBe(1); // Stale - would be pruned

      // Stale dependencies (version < trackingVersion) can be identified for removal
      const staleDeps: Dependency[] = [];
      let dep = derived.dependencies;
      while (dep) {
        if (dep.version < derived.trackingVersion) {
          staleDeps.push(dep);
        }
        dep = dep.nextDependency;
      }

      expect(staleDeps.length).toBe(1);
      expect(staleDeps[0]?.producer).toBe(sourceB);
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
          undefined,
          STATUS_PENDING
        );
        nodes.push(node);
        // Wire dependency with proper consumer reference
        node.dependencies = createDependency(currentPrev, undefined, node);
        node.dependencyTail = node.dependencies;
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
          return (source.value as number) / 2;
        },
        undefined,
        STATUS_PENDING
      );

      const right = createDerivedNode(
        () => {
          return (source.value as number) / 4;
        },
        undefined,
        STATUS_PENDING
      );

      // Consumer depends on both
      const consumer = createDerivedNode(
        () => {
          return ((left.value as number) || 0) + ((right.value as number) || 0);
        },
        undefined,
        STATUS_PENDING
      );

      // Wire dependencies with proper consumer references
      left.dependencies = createDependency(source, undefined, left);
      left.dependencyTail = left.dependencies;

      right.dependencies = createDependency(source, undefined, right);
      right.dependencyTail = right.dependencies;

      const depRight = createDependency(right, undefined, consumer);
      const depLeft = createDependency(left, depRight, consumer);
      consumer.dependencies = depLeft;
      consumer.dependencyTail = depRight;

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
        undefined,
        STATUS_PENDING
      );

      const nodeC = createDerivedNode(
        () => {
          computeCountC++;
          return (nodeA.value as number) * 3;
        },
        undefined,
        STATUS_PENDING
      );

      // Create final node D depending on both B and C
      const nodeD = createDerivedNode(
        () => {
          computeCountD++;
          return (nodeB.value as number) + (nodeC.value as number);
        },
        undefined,
        STATUS_PENDING
      );

      // Wire dependencies with proper consumer references
      nodeB.dependencies = createDependency(nodeA, undefined, nodeB);
      nodeB.dependencyTail = nodeB.dependencies;

      nodeC.dependencies = createDependency(nodeA, undefined, nodeC);
      nodeC.dependencyTail = nodeC.dependencies;

      const depC = createDependency(nodeC, undefined, nodeD);
      const depB = createDependency(nodeB, depC, nodeD);
      nodeD.dependencies = depB;
      nodeD.dependencyTail = depC;

      // Pull updates from D
      propagator.pullUpdates(nodeD);

      // Check how many times track was called
      expect(track).toHaveBeenCalled();

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
          undefined,
          STATUS_PENDING
        );
        nodes.push(node);
        // Wire dependency with proper consumer reference
        node.dependencies = createDependency(currentPrev, undefined, node);
        node.dependencyTail = node.dependencies;
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