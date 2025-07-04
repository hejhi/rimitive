import { describe, it, expect, beforeEach } from 'vitest';
import {
  acquireNode,
  releaseNode,
  addDependency,
  prepareSources,
  cleanupSources,
  disposeComputed,
  notifyTargets,
  getPoolSize,
  clearPool,
  resetGlobalState,
} from './test-setup';
import type { Signal, Computed, DependencyNode } from './types';

// Mock signal factory
function createMockSignal<T>(value: T): Signal<T> {
  const signal = function (newValue?: T) {
    if (arguments.length === 0) {
      return signal._value;
    }
    signal._value = newValue!;
    signal._version++;
    return undefined;
  } as Signal<T>;

  signal._value = value;
  signal._version = 0;
  return signal;
}

// Mock computed factory
function createMockComputed<T>(fn: () => T): Computed<T> {
  const computed = function () {
    return computed._value;
  } as Computed<T>;

  computed._fn = fn;
  computed._value = fn();
  computed._version = 0;
  computed._globalVersion = 0;
  computed._flags = 0;
  computed._notify = () => {};
  computed._recompute = () => computed._value!;
  computed.dispose = () => {};

  return computed;
}

describe('node.ts', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('acquireNode', () => {
    it('should create a new node when pool is empty', () => {
      const source = createMockSignal(1);
      const target = createMockComputed(() => 1);

      const node = acquireNode(source, target);

      expect(node.source).toBe(source);
      expect(node.target).toBe(target);
      expect(node.version).toBe(0); // source._version is 0
      expect(node.prevSource).toBeUndefined();
      expect(node.nextSource).toBeUndefined();
      expect(node.prevTarget).toBeUndefined();
      expect(node.nextTarget).toBeUndefined();
    });

    it('should reuse node from pool when available', () => {
      // If pool has pre-allocated nodes, acquiring one will decrease the count
      const source1 = createMockSignal(1);
      const target1 = createMockComputed(() => 1);
      const node1 = acquireNode(source1, target1);
      
      const poolSizeAfterAcquire = getPoolSize();
      
      releaseNode(node1);
      expect(getPoolSize()).toBe(poolSizeAfterAcquire + 1);

      const source2 = createMockSignal(2);
      const target2 = createMockComputed(() => 2);
      const node2 = acquireNode(source2, target2);

      // Should be the same object reference
      expect(node2).toBe(node1);
      expect(node2.source).toBe(source2);
      expect(node2.target).toBe(target2);
      expect(node2.version).toBe(0);
    });

    it('should capture current source version', () => {
      const source = createMockSignal(1);
      source._version = 5;
      const target = createMockComputed(() => 1);

      const node = acquireNode(source, target);

      expect(node.version).toBe(5);
    });
  });

  describe('releaseNode', () => {
    it('should clear all node references', () => {
      const source = createMockSignal(1);
      const target = createMockComputed(() => 1);
      const node = acquireNode(source, target);

      // Set up some links
      node.prevSource = {} as DependencyNode;
      node.nextSource = {} as DependencyNode;
      node.prevTarget = {} as DependencyNode;
      node.nextTarget = {} as DependencyNode;

      releaseNode(node);

      expect(node.source).toBeUndefined();
      expect(node.target).toBeUndefined();
      expect(node.prevSource).toBeUndefined();
      expect(node.nextSource).toBeUndefined();
      expect(node.prevTarget).toBeUndefined();
      expect(node.nextTarget).toBeUndefined();
      expect(node.version).toBe(-1);
    });

    it('should add node to pool if under max size', () => {
      // Clear pool to test from empty state
      clearPool();
      
      const source = createMockSignal(1);
      const target = createMockComputed(() => 1);
      const node = acquireNode(source, target);

      expect(getPoolSize()).toBe(0);
      releaseNode(node);
      expect(getPoolSize()).toBe(1);
    });

    it('should not exceed max pool size', () => {
      clearPool(); // Start fresh

      // Create and release many nodes
      const nodes = [];
      for (let i = 0; i < 1100; i++) {
        const source = createMockSignal(i);
        const target = createMockComputed(() => i);
        const node = acquireNode(source, target);
        nodes.push(node);
      }

      // Release all nodes
      for (const node of nodes) {
        releaseNode(node);
      }

      expect(getPoolSize()).toBe(1000); // MAX_POOL_SIZE
    });
  });

  describe('addDependency', () => {
    it('should create new dependency node', () => {
      const source = createMockSignal(1);
      const target = createMockComputed(() => source());

      addDependency(source, target);

      expect(target._sources).toBeDefined();
      expect(target._sources!.source).toBe(source);
      expect(target._sources!.target).toBe(target);
      expect(source._targets).toBeDefined();
      expect(source._targets!.source).toBe(source);
      expect(source._targets!.target).toBe(target);
    });

    it('should update version if dependency already exists', () => {
      const source = createMockSignal(1);
      const target = createMockComputed(() => source());

      addDependency(source, target);
      const firstNode = target._sources!;

      source._version = 5;
      addDependency(source, target);

      // Should be the same node, just updated version
      expect(target._sources).toBe(firstNode);
      expect(target._sources!.version).toBe(5);
    });

    it('should handle multiple dependencies', () => {
      const source1 = createMockSignal(1);
      const source2 = createMockSignal(2);
      const target = createMockComputed(() => source1() + source2());

      addDependency(source1, target);
      addDependency(source2, target);

      // Check target has both sources
      let count = 0;
      let node = target._sources;
      while (node) {
        count++;
        expect(node.source === source1 || node.source === source2).toBe(true);
        node = node.nextSource;
      }
      expect(count).toBe(2);
    });

    it('should handle multiple targets for one source', () => {
      const source = createMockSignal(1);
      const target1 = createMockComputed(() => source());
      const target2 = createMockComputed(() => source());

      addDependency(source, target1);
      addDependency(source, target2);

      // Check source has both targets
      let count = 0;
      let node = source._targets;
      while (node) {
        count++;
        expect(node.target === target1 || node.target === target2).toBe(true);
        node = node.nextTarget;
      }
      expect(count).toBe(2);
    });
  });

  describe('prepareSources', () => {
    it('should mark all sources with version -1', () => {
      const source1 = createMockSignal(1);
      const source2 = createMockSignal(2);
      const target = createMockComputed(() => source1() + source2());

      addDependency(source1, target);
      addDependency(source2, target);

      prepareSources(target);

      let node = target._sources;
      while (node) {
        expect(node.version).toBe(-1);
        node = node.nextSource;
      }
    });

    it('should handle target with no sources', () => {
      const target = createMockComputed(() => 1);

      // Should not throw
      expect(() => prepareSources(target)).not.toThrow();
    });
  });

  describe('cleanupSources', () => {
    it('should remove nodes marked with version -1', () => {
      const source1 = createMockSignal(1);
      const source2 = createMockSignal(2);
      const source3 = createMockSignal(3);
      const target = createMockComputed(
        () => source1() + source2() + source3()
      );

      addDependency(source1, target);
      addDependency(source2, target);
      addDependency(source3, target);

      // Mark all for cleanup
      prepareSources(target);

      // Keep source2 by updating its version
      let node = target._sources;
      while (node) {
        if (node.source === source2) {
          node.version = 1;
          break;
        }
        node = node.nextSource;
      }

      cleanupSources(target);

      // Should only have source2 left
      expect(target._sources).toBeDefined();
      expect(target._sources!.source).toBe(source2);
      expect(target._sources!.nextSource).toBeUndefined();

      // Check that source1 and source3 no longer have target
      expect(source1._targets).toBeUndefined();
      expect(source3._targets).toBeUndefined();
      expect(source2._targets).toBeDefined();
    });

    it('should handle removing all sources', () => {
      const source = createMockSignal(1);
      const target = createMockComputed(() => source());

      addDependency(source, target);
      prepareSources(target);
      cleanupSources(target);

      expect(target._sources).toBeUndefined();
      expect(source._targets).toBeUndefined();
    });

    it('should return nodes to pool', () => {
      const source = createMockSignal(1);
      const target = createMockComputed(() => source());

      addDependency(source, target);
      const poolSizeBefore = getPoolSize();

      prepareSources(target);
      cleanupSources(target);

      expect(getPoolSize()).toBe(poolSizeBefore + 1);
    });
  });

  describe('disposeComputed', () => {
    it('should remove all dependencies', () => {
      const source1 = createMockSignal(1);
      const source2 = createMockSignal(2);
      const target = createMockComputed(() => source1() + source2());

      addDependency(source1, target);
      addDependency(source2, target);

      disposeComputed(target);

      expect(target._sources).toBeUndefined();
      expect(source1._targets).toBeUndefined();
      expect(source2._targets).toBeUndefined();
    });

    it('should handle computed with no dependencies', () => {
      const target = createMockComputed(() => 1);

      // Should not throw
      expect(() => disposeComputed(target)).not.toThrow();
    });

    it('should properly unlink from middle of target list', () => {
      const source = createMockSignal(1);
      const target1 = createMockComputed(() => source());
      const target2 = createMockComputed(() => source());
      const target3 = createMockComputed(() => source());

      addDependency(source, target1);
      addDependency(source, target2);
      addDependency(source, target3);

      disposeComputed(target2);

      // Check that target1 and target3 are still linked
      let found1 = false,
        found3 = false;
      let node = source._targets;
      while (node) {
        if (node.target === target1) found1 = true;
        if (node.target === target3) found3 = true;
        node = node.nextTarget;
      }

      expect(found1).toBe(true);
      expect(found3).toBe(true);
    });
  });

  describe('notifyTargets', () => {
    it('should call _notify on all targets', () => {
      const source = createMockSignal(1);
      const notifyCalls: Computed<number>[] = [];

      const target1 = createMockComputed(() => source());
      target1._notify = () => notifyCalls.push(target1);

      const target2 = createMockComputed(() => source());
      target2._notify = () => notifyCalls.push(target2);

      addDependency(source, target1);
      addDependency(source, target2);

      notifyTargets(source);

      expect(notifyCalls).toHaveLength(2);
      expect(notifyCalls).toContain(target1);
      expect(notifyCalls).toContain(target2);
    });

    it('should handle source with no targets', () => {
      const source = createMockSignal(1);

      // Should not throw
      expect(() => notifyTargets(source)).not.toThrow();
    });
  });

  describe('getPoolSize', () => {
    it('should return current pool size', () => {
      // Clear pool to test from known state
      clearPool();
      expect(getPoolSize()).toBe(0);

      const source = createMockSignal(1);
      const target = createMockComputed(() => 1);
      const node = acquireNode(source, target);

      releaseNode(node);
      expect(getPoolSize()).toBe(1);
    });
  });

  describe('clearPool', () => {
    it('should empty the node pool', () => {
      clearPool(); // Start fresh

      // Add some nodes to pool
      const nodes = [];
      for (let i = 0; i < 10; i++) {
        const source = createMockSignal(i);
        const target = createMockComputed(() => i);
        const node = acquireNode(source, target);
        nodes.push(node);
      }

      // Release all nodes to pool
      for (const node of nodes) {
        releaseNode(node);
      }

      expect(getPoolSize()).toBe(10);
      clearPool();
      expect(getPoolSize()).toBe(0);
    });
  });
});
