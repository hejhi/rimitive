import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyHelpers } from './dependency-tracking';
import { createNodePoolHelpers } from './node-pool';
import { createContext } from '../context';
import type { SignalContext } from '../context';
import type { Producer, Consumer } from '../types';

describe('Dependency Tracking Helpers', () => {
  let ctx: SignalContext;
  let pool: ReturnType<typeof createNodePoolHelpers>;
  let helpers: ReturnType<typeof createDependencyHelpers>;

  beforeEach(() => {
    ctx = createContext();
    pool = createNodePoolHelpers(ctx);
    helpers = createDependencyHelpers(pool);
  });

  describe('addDependency', () => {
    it('should reuse cached node when available', () => {
      const source: Producer = {
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      // First call creates the dependency
      helpers.addDependency(source, target, 1);
      const cachedNode = source._node;
      
      // Update version
      source._version = 2;
      
      // Second call should reuse the cached node
      helpers.addDependency(source, target, 2);
      
      expect(source._node).toBe(cachedNode);
      expect(source._node?.version).toBe(2);
    });

    it('should find existing dependency in sources list', () => {
      const source: Producer = {
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      // Create dependency manually
      const existingNode = pool.linkNodes(source, target, 1);
      
      // Clear the cached node to force search
      source._node = undefined;
      
      // Update version
      source._version = 2;
      
      // Should find the existing dependency
      helpers.addDependency(source, target, 2);
      
      expect(existingNode.version).toBe(2);
      expect(target._sources).toBe(existingNode);
    });

    it('should create new dependency when none exists', () => {
      const source: Producer = {
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      helpers.addDependency(source, target, 1);
      
      expect(source._targets).toBeDefined();
      expect(target._sources).toBeDefined();
    });

    it('should handle multiple sources for the same target', () => {
      const sources = Array.from({ length: 3 }, (_, i) => ({
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: i + 1,
      }));
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      // Add dependencies from multiple sources
      sources.forEach(source => {
        helpers.addDependency(source, target, source._version);
      });
      
      // Count sources
      let count = 0;
      let node = target._sources;
      while (node) {
        count++;
        node = node.nextSource;
      }
      
      expect(count).toBe(3);
    });

    it('should update version when dependency already exists', () => {
      const source: Producer = {
        value: 0,
        peek: () => 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
        dispose() {},
      };
      
      // Create initial dependency
      helpers.addDependency(source, target, 1);
      
      // Update version
      source._version = 5;
      
      // Update dependency
      helpers.addDependency(source, target, 5);
      
      // Check that version was updated
      const node = target._sources;
      expect(node?.version).toBe(5);
    });
  });
});