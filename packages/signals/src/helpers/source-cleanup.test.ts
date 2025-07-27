import { describe, it, expect, beforeEach } from 'vitest';
import { createSourceCleanupHelpers } from './source-cleanup';
import { createNodePoolHelpers } from './node-pool';
import { createContext } from '../context';
import type { SignalContext } from '../context';
import type { Producer, Consumer, Edge } from '../types';

describe('Source Cleanup Helpers', () => {
  let ctx: SignalContext;
  let pool: ReturnType<typeof createNodePoolHelpers>;
  let helpers: ReturnType<typeof createSourceCleanupHelpers>;

  beforeEach(() => {
    ctx = createContext();
    pool = createNodePoolHelpers(ctx);
    helpers = createSourceCleanupHelpers(pool);
  });

  describe('disposeAllSources', () => {
    it('should remove all source dependencies', () => {
      const sources = Array.from({ length: 3 }, () => ({
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      }));
      
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _flags: 0,
        _invalidate: () => {},
        dispose() {},
      };
      
      // Create dependencies
      sources.forEach(source => {
        pool.linkNodes(source, consumer, 1);
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
      const source: Producer = {
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      pool.linkNodes(source, consumer, 1);
      helpers.disposeAllSources(consumer);
    });

    it('should handle empty sources gracefully', () => {
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      // Should not throw
      expect(() => helpers.disposeAllSources(consumer)).not.toThrow();
      expect(consumer._sources).toBeUndefined();
    });
  });

  describe('cleanupSources', () => {
    it('should remove only nodes with version -1', () => {
      const sources = Array.from({ length: 4 }, (_, i) => ({
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: i + 1,
      }));
      
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      // Create dependencies
      const nodes = sources.map(source => 
        pool.linkNodes(source, consumer, source._version)
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
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: i + 1,
      }));
      
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      // Create dependencies
      const nodes = sources.map(source => 
        pool.linkNodes(source, consumer, source._version)
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
      const source: Producer = {
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      const node = pool.linkNodes(source, consumer, 1);
      node.version = -1;
      
      helpers.cleanupSources(consumer);
      
      expect(consumer._sources).toBeUndefined();
    });

    it('should release cleaned up nodes', () => {
      const sources = Array.from({ length: 3 }, () => ({
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      }));
      
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      const nodes = sources.map(source => 
        pool.linkNodes(source, consumer, 1)
      );
      
      // Mark for cleanup
      nodes.forEach(node => node.version = -1);
      
      helpers.cleanupSources(consumer);
    });

    it('should handle empty sources gracefully', () => {
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
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
        _node: undefined,
        _version: i + 1,
      }));
      
      const consumer: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      const nodes = sources.map(source => 
        pool.linkNodes(source, consumer, source._version)
      );
      
      // Mark first node for cleanup
      nodes[2]!.version = -1; // Most recent node is first in list
      
      helpers.cleanupSources(consumer);
      
      // Consumer should now point to the second node
      expect(consumer._sources).toBe(nodes[1]);
    });
  });
});