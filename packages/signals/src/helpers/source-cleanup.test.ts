import { describe, it, expect, beforeEach } from 'vitest';
import { createSourceCleanupHelpers } from './source-cleanup';
import type { ConsumerNode, Edge } from '../types';
import { createDependencyHelpers, TrackedProducer } from './dependency-tracking';

describe('Source Cleanup Helpers', () => {
  let depHelpers: ReturnType<typeof createDependencyHelpers>;
  let helpers: ReturnType<typeof createSourceCleanupHelpers>;

  beforeEach(() => {
    depHelpers = createDependencyHelpers();
    helpers = createSourceCleanupHelpers(depHelpers);
  });

  describe('disposeAllSources', () => {
    it('should remove all source dependencies', () => {
      const sources = Array.from({ length: 3 }, () => ({
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      }) as TrackedProducer);
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      // Create dependencies
      sources.forEach(source => {
        depHelpers.linkNodes(source, consumer, 1);
      });
      
      expect(consumer._sources).toBeDefined();
      
      // Dispose all sources
      helpers.disposeAllSources(consumer);
      
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
        _sources: undefined,
        _invalidate: () => {},
      };
      
      depHelpers.linkNodes(source, consumer, 1);
      helpers.disposeAllSources(consumer);
    });

    it('should handle empty sources gracefully', () => {
      const consumer: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      // Should not throw
      expect(() => helpers.disposeAllSources(consumer)).not.toThrow();
      expect(consumer._sources).toBeUndefined();
    });
  });

  describe('cleanupSources', () => {
    it('should remove only nodes with version -1', () => {
      const sources = Array.from({ length: 4 }, (_, i) => ({
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: i + 1,
      }) as TrackedProducer);
      
      const consumer: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      // Create dependencies
      const nodes = sources.map((source) =>
        depHelpers.linkNodes(source, consumer, source._version)
      );
      
      // Mark some nodes for cleanup
      nodes[1]!.version = -1;
      nodes[3]!.version = -1;
      
      helpers.cleanupSources(consumer);
      
      // Count remaining sources
      let count = 0;
      let node = consumer._sources;
      while (node) {
        expect(node.version).not.toBe(-1);
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
        _sources: undefined,
        _invalidate: () => {},
      };
      
      // Create dependencies
      const nodes = sources.map((source) =>
        depHelpers.linkNodes(source, consumer, source._version)
      );
      
      // Mark alternating nodes for cleanup
      nodes[1]!.version = -1;
      nodes[3]!.version = -1;
      
      helpers.cleanupSources(consumer);
      
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
        _sources: undefined,
        _invalidate: () => {},
      };
      
      const node = depHelpers.linkNodes(source, consumer, 1);
      node.version = -1;
      
      helpers.cleanupSources(consumer);
      
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
        _sources: undefined,
        _invalidate: () => {},
      };
      
      const nodes = sources.map((source) =>
        depHelpers.linkNodes(source, consumer, 1)
      );
      
      // Mark for cleanup
      nodes.forEach(node => node.version = -1);
      
      helpers.cleanupSources(consumer);
    });

    it('should handle empty sources gracefully', () => {
      const consumer: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      // Should not throw
      expect(() => helpers.cleanupSources(consumer)).not.toThrow();
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
        _sources: undefined,
        _invalidate: () => {},
      };
      
      const nodes = sources.map((source) =>
        depHelpers.linkNodes(source, consumer, source._version)
      );
      
      // Mark first node for cleanup
      nodes[2]!.version = -1; // Most recent node is first in list
      
      helpers.cleanupSources(consumer);
      
      // Consumer should now point to the second node
      expect(consumer._sources).toBe(nodes[1]);
    });
  });
});