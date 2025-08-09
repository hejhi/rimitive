import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencySweeper } from './dependency-sweeper';
import type { ConsumerNode, Edge } from '../types';
import { createDependencyGraph, TrackedProducer } from './dependency-graph';

describe('Dependency Sweeper', () => {
  let depHelpers: ReturnType<typeof createDependencyGraph>;
  let helpers: ReturnType<typeof createDependencySweeper>;

  beforeEach(() => {
    depHelpers = createDependencyGraph();
    helpers = createDependencySweeper(depHelpers.unlinkFromProducer);
  });

  describe('detachAll', () => {
    it('should remove all source dependencies', () => {
      const sources = Array.from({ length: 3 }, () => ({
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      }) as TrackedProducer);
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      // Create dependencies
      sources.forEach(source => {
        depHelpers.connect(source, consumer, 1);
      });
      
      expect(consumer._sources).toBeDefined();
      
      // Dispose all sources
      helpers.detachAll(consumer);
      
      expect(consumer._sources).toBeUndefined();
      
      // Check that all source targets were cleaned up
      sources.forEach(source => {
        expect(source._targets).toBeUndefined();
      });
    });

    it('should release nodes back to pool', () => {
      const source: TrackedProducer = {
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      };
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      depHelpers.connect(source, consumer, 1);
      helpers.detachAll(consumer);
    });

    it('should handle empty sources gracefully', () => {
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      // Should not throw
      expect(() => helpers.detachAll(consumer)).not.toThrow();
      expect(consumer._sources).toBeUndefined();
    });
  });

  describe('pruneStale', () => {
    it('should remove only nodes with old generation', () => {
      const sources = Array.from({ length: 4 }, (_, i) => ({
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: i + 1,
      }) as TrackedProducer);
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      // Create dependencies with current generation
      const nodes = sources.map((source) =>
        depHelpers.connect(source, consumer, source._version)
      );
      
      // Increment generation (simulating recomputation)
      consumer._generation++;
      
      // Update some nodes to new generation (simulating access during recomputation)
      nodes[0]!.generation = consumer._generation;
      nodes[2]!.generation = consumer._generation;
      
      helpers.pruneStale(consumer);
      
      // Count remaining sources
      let count = 0;
      let node = consumer._sources;
      while (node) {
        expect(node.generation).toBe(consumer._generation);
        count++;
        node = node.nextSource;
      }
      
      expect(count).toBe(2);
    });

    it('should maintain linked list integrity', () => {
      const sources = Array.from({ length: 5 }, (_, i) => ({
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: i + 1,
      }) as TrackedProducer);
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      // Create dependencies
      const nodes = sources.map((source) =>
        depHelpers.connect(source, consumer, source._version)
      );
      
      // Increment generation and mark some nodes as accessed
      consumer._generation++;
      nodes[0]!.generation = consumer._generation;
      nodes[2]!.generation = consumer._generation;
      nodes[4]!.generation = consumer._generation;
      
      helpers.pruneStale(consumer);
      
      // Check that remaining nodes are properly linked
      let node = consumer._sources;
      let prev: Edge | undefined;
      while (node) {
        if (prev) {
          expect(node.prevSource).toBe(prev);
          expect(prev.nextSource).toBe(node);
        }
        prev = node;
        node = node.nextSource;
      }
    });

    it('should handle all nodes marked for cleanup', () => {
      const source: TrackedProducer = {
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      };
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      depHelpers.connect(source, consumer, 1);
      
      // Increment generation but don't update any nodes
      consumer._generation++;
      
      helpers.pruneStale(consumer);
      
      expect(consumer._sources).toBeUndefined();
    });

    it('should release cleaned up nodes', () => {
      const sources = Array.from({ length: 3 }, () => ({
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      }) as TrackedProducer);
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      sources.map((source) =>
        depHelpers.connect(source, consumer, 1)
      );
      
      // Increment generation but don't update any nodes
      consumer._generation++;
      
      helpers.pruneStale(consumer);
    });

    it('should handle empty sources gracefully', () => {
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      // Should not throw
      expect(() => helpers.pruneStale(consumer)).not.toThrow();
      expect(consumer._sources).toBeUndefined();
    });

    it('should update head when first node is removed', () => {
      const sources = Array.from({ length: 3 }, (_, i) => ({
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: i + 1,
      }));
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _generation: 1,
        _invalidate: () => {},
        _refresh: () => true,
      };
      
      const nodes = sources.map((source) =>
        depHelpers.connect(source, consumer, source._version)
      );
      
      // Increment generation and update only some nodes
      consumer._generation++;
      nodes[0]!.generation = consumer._generation;
      nodes[1]!.generation = consumer._generation;
      // nodes[2] stays with old generation
      
      helpers.pruneStale(consumer);
      
      // Consumer should now point to the second node
      expect(consumer._sources).toBe(nodes[1]);
    });
  });
});

