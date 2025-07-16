/**
 * Signal instrumentation for DevTools
 * 
 * This module handles the instrumentation of Signal primitives
 * for tracking reads, writes, and dependency updates.
 */

import type { Signal } from '@lattice/signals';
import type { LatticeContext } from '@lattice/core';
import type { PrimitiveRegistry } from '../tracking/registry';
import type { EventEmitter } from '../events/emitter';
import type { DevToolsOptions } from '../types';
import { executionContext } from '../tracking/execution-context';
import { wrapSelectMethod } from '../tracking/selectors';
import { getDependencySnapshot } from './dependency-snapshot';

/**
 * Options for signal instrumentation
 */
export interface SignalInstrumentationOptions {
  contextId: string;
  registry: PrimitiveRegistry;
  eventEmitter: EventEmitter;
  devToolsOptions: DevToolsOptions;
}

/**
 * Instrument a signal for DevTools tracking
 */
export function instrumentSignal<T>(
  context: LatticeContext,
  initialValue: T,
  name: string | undefined,
  options: SignalInstrumentationOptions
): Signal<T> {
  // Create the signal
  const signal = context.signal(initialValue);
  
  // Register the signal
  const tracked = options.registry.registerSignal(signal, options.contextId, name);
  
  // Emit creation event
  options.eventEmitter.emit({
    type: 'SIGNAL_CREATED',
    contextId: options.contextId,
    timestamp: Date.now(),
    data: {
      id: tracked.id,
      name,
      initialValue,
    },
  });
  
  // Update context count
  options.eventEmitter.emit({
    type: 'CONTEXT_CREATED',
    contextId: options.contextId,
    timestamp: Date.now(),
    data: { id: options.contextId, name: 'signal' },
  });
  
  // Instrument value getter/setter
  instrumentSignalValue(signal, tracked.id, name, options);
  
  // Wrap select method
  wrapSelectMethod(signal, tracked, {
    contextId: options.contextId,
    registry: options.registry,
    eventEmitter: options.eventEmitter,
    trackReads: options.devToolsOptions.trackReads,
  });
  
  // Emit initial dependency snapshot
  setTimeout(() => {
    options.eventEmitter.emit(getDependencySnapshot(tracked, 'created', options.registry));
  }, 0);
  
  return signal;
}

/**
 * Instrument signal value property for read/write tracking
 */
function instrumentSignalValue<T>(
  signal: Signal<T>,
  signalId: string,
  name: string | undefined,
  options: Pick<SignalInstrumentationOptions, 'contextId' | 'eventEmitter' | 'devToolsOptions' | 'registry'>
): void {
  // Get the property descriptor from the prototype
  const proto = Object.getPrototypeOf(signal) as object | null;
  const descriptor = proto
    ? Object.getOwnPropertyDescriptor(proto, 'value')
    : undefined;

  if (!descriptor?.set || !descriptor?.get) return;

  const originalSet = descriptor.set.bind(signal);
  const originalGet = descriptor.get.bind(signal);

  Object.defineProperty(signal, 'value', {
    get() {
      const value = originalGet() as T;

      // Only emit reads if tracking is enabled and we're in execution context
      if (options.devToolsOptions.trackReads && executionContext.current) {
        options.eventEmitter.emit({
          type: 'SIGNAL_READ',
          contextId: options.contextId,
          timestamp: Date.now(),
          data: {
            id: signalId,
            name,
            value,
            executionContext: executionContext.current,
          },
        });
      }

      return value;
    },
    
    set(newValue: T) {
      const oldValue = originalGet() as T;
      const result = originalSet(newValue);

      // Emit write event
      options.eventEmitter.emit({
        type: 'SIGNAL_WRITE',
        contextId: options.contextId,
        timestamp: Date.now(),
        data: {
          id: signalId,
          name,
          oldValue,
          newValue,
        },
      });

      // Emit dependency snapshot after write
      const tracked = options.registry.get(signal);
      if (tracked) {
        setTimeout(() => {
          options.eventEmitter.emit(getDependencySnapshot(tracked, 'updated', options.registry));
        }, 0);
      }

      return result;
    },
    
    enumerable: descriptor.enumerable,
    configurable: true,
  });
}