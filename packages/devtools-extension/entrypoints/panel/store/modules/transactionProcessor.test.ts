import { describe, it, expect } from 'vitest';
import { createTransaction, getEventCategory } from './transactionProcessor';
import type { LatticeEvent } from './messageHandler';

describe('transactionProcessor', () => {
  describe('getEventCategory', () => {
    it('should categorize signal events', () => {
      expect(getEventCategory('SIGNAL_CREATED')).toBe('signal');
      expect(getEventCategory('SIGNAL_WRITE')).toBe('signal');
      expect(getEventCategory('SIGNAL_READ')).toBe('signal');
    });

    it('should categorize computed events', () => {
      expect(getEventCategory('COMPUTED_CREATED')).toBe('computed');
      expect(getEventCategory('COMPUTED_START')).toBe('computed');
      expect(getEventCategory('COMPUTED_END')).toBe('computed');
    });

    it('should categorize effect events', () => {
      expect(getEventCategory('EFFECT_CREATED')).toBe('effect');
      expect(getEventCategory('EFFECT_START')).toBe('effect');
      expect(getEventCategory('EFFECT_END')).toBe('effect');
    });

    it('should categorize selector events', () => {
      expect(getEventCategory('SELECTOR_CREATED')).toBe('selector');
    });

    it('should default to batch for unknown events', () => {
      expect(getEventCategory('UNKNOWN_EVENT')).toBe('batch');
      expect(getEventCategory('BATCH_START')).toBe('batch');
    });
  });

  describe('createTransaction', () => {
    it('should create a transaction with proper structure', () => {
      const event: LatticeEvent = {
        type: 'SIGNAL_WRITE',
        contextId: 'ctx-123',
        timestamp: 1234567890,
        data: {
          id: 'sig-1',
          oldValue: 0,
          newValue: 1,
        },
      };

      const transaction = createTransaction(event);

      expect(transaction).toMatchObject({
        timestamp: 1234567890,
        contextId: 'ctx-123',
        type: 'signal',
        eventType: 'SIGNAL_WRITE',
        data: event.data,
      });
      expect(transaction.id).toMatch(/^tx_\d+_[\d.]+$/);
    });

    it('should use current timestamp if not provided', () => {
      const now = Date.now();
      const event: LatticeEvent = {
        type: 'COMPUTED_START',
        contextId: 'ctx-456',
        data: { id: 'comp-1' },
      };

      const transaction = createTransaction(event);

      expect(transaction.timestamp).toBeGreaterThanOrEqual(now);
      expect(transaction.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });
});