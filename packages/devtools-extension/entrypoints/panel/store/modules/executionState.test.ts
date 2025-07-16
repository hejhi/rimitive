import { describe, it, expect, beforeEach } from 'vitest';
import {
  createExecutionState,
  trackRecentWrite,
  startComputed,
  endComputed,
  startEffect,
  endEffect,
  findRecentTrigger,
} from './executionState';

describe('executionState', () => {
  let state: ReturnType<typeof createExecutionState>;

  beforeEach(() => {
    state = createExecutionState();
  });

  describe('createExecutionState', () => {
    it('should create initial state with empty collections', () => {
      expect(state.activeEffects.size).toBe(0);
      expect(state.activeComputeds.size).toBe(0);
      expect(state.recentWrites.size).toBe(0);
      expect(state.currentLevel).toBe(0);
    });
  });

  describe('trackRecentWrite', () => {
    it('should track a recent write', () => {
      const nodeId = 'signal-1';
      const timestamp = Date.now();

      trackRecentWrite(state, nodeId, timestamp);

      const write = state.recentWrites.get(nodeId);
      expect(write).toEqual({ timestamp, nodeId });
    });

    it('should overwrite previous writes for same node', () => {
      const nodeId = 'signal-1';
      trackRecentWrite(state, nodeId, 1000);
      trackRecentWrite(state, nodeId, 2000);

      expect(state.recentWrites.size).toBe(1);
      expect(state.recentWrites.get(nodeId)?.timestamp).toBe(2000);
    });
  });

  describe('computed tracking', () => {
    it('should start and end computed tracking', () => {
      const id = 'computed-1';
      const triggeredBy = ['signal-1'];
      const oldValue = 42;
      const timestamp = Date.now();

      startComputed(state, id, triggeredBy, oldValue, timestamp);

      expect(state.activeComputeds.has(id)).toBe(true);
      expect(state.currentLevel).toBe(1);

      const activeComputed = state.activeComputeds.get(id);
      expect(activeComputed).toEqual({
        startTime: timestamp,
        triggeredBy,
        oldValue,
      });

      const ended = endComputed(state, id);

      expect(state.activeComputeds.has(id)).toBe(false);
      expect(state.currentLevel).toBe(0);
      expect(ended).toEqual({
        startTime: timestamp,
        triggeredBy,
        oldValue,
      });
    });

    it('should handle ending non-existent computed', () => {
      const result = endComputed(state, 'non-existent');
      expect(result).toBeUndefined();
      expect(state.currentLevel).toBe(0);
    });

    it('should maintain correct level with nested computeds', () => {
      startComputed(state, 'comp-1', [], undefined);
      expect(state.currentLevel).toBe(1);

      startComputed(state, 'comp-2', [], undefined);
      expect(state.currentLevel).toBe(2);

      endComputed(state, 'comp-2');
      expect(state.currentLevel).toBe(1);

      endComputed(state, 'comp-1');
      expect(state.currentLevel).toBe(0);
    });
  });

  describe('effect tracking', () => {
    it('should start and end effect tracking', () => {
      const id = 'effect-1';
      const triggeredBy = ['signal-1'];
      const timestamp = Date.now();

      startEffect(state, id, triggeredBy, timestamp);

      expect(state.activeEffects.has(id)).toBe(true);
      expect(state.currentLevel).toBe(1);

      const activeEffect = state.activeEffects.get(id);
      expect(activeEffect).toEqual({
        startTime: timestamp,
        triggeredBy,
      });

      const ended = endEffect(state, id);

      expect(state.activeEffects.has(id)).toBe(false);
      expect(state.currentLevel).toBe(0);
      expect(ended).toEqual({
        startTime: timestamp,
        triggeredBy,
      });
    });
  });

  describe('findRecentTrigger', () => {
    it('should find recent trigger within time window', () => {
      const nodeId = 'computed-1';
      const depId = 'signal-1';
      const dependencies = new Set([depId]);
      const timestamp = Date.now();

      trackRecentWrite(state, depId, timestamp);

      const trigger = findRecentTrigger(state, nodeId, dependencies, 100);
      expect(trigger).toBe(depId);
    });

    it('should not find trigger outside time window', () => {
      const nodeId = 'computed-1';
      const depId = 'signal-1';
      const dependencies = new Set([depId]);
      const timestamp = Date.now() - 200;

      trackRecentWrite(state, depId, timestamp);

      const trigger = findRecentTrigger(state, nodeId, dependencies, 100);
      expect(trigger).toBeNull();
    });

    it('should return most recent trigger when multiple exist', () => {
      const nodeId = 'computed-1';
      const dep1 = 'signal-1';
      const dep2 = 'signal-2';
      const dependencies = new Set([dep1, dep2]);
      const now = Date.now();

      trackRecentWrite(state, dep1, now - 50);
      trackRecentWrite(state, dep2, now - 20);

      const trigger = findRecentTrigger(state, nodeId, dependencies, 100);
      expect(trigger).toBe(dep2);
    });

    it('should return null for empty dependencies', () => {
      const trigger = findRecentTrigger(state, 'node-1', new Set(), 100);
      expect(trigger).toBeNull();
    });
  });
});