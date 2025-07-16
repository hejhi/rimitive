import { Transaction, TransactionData } from '../types';
import { LatticeEvent } from './messageHandler';

export function createTransaction(event: LatticeEvent): Transaction {
  return {
    id: `tx_${Date.now()}_${Math.random()}`,
    timestamp: event.timestamp || Date.now(),
    contextId: event.contextId,
    type: getEventCategory(event.type),
    eventType: event.type,
    data: event.data as TransactionData,
  };
}

export function getEventCategory(
  eventType: string
): 'signal' | 'computed' | 'effect' | 'batch' | 'selector' {
  if (eventType.startsWith('SIGNAL_')) return 'signal';
  if (eventType.startsWith('COMPUTED_')) return 'computed';
  if (eventType.startsWith('EFFECT_')) return 'effect';
  if (eventType.startsWith('SELECTOR_')) return 'selector';
  return 'batch';
}