/**
 * Registry for tracking reactive primitives and their metadata
 * 
 * This module provides a centralized registry for all tracked primitives,
 * ensuring consistent ID management and efficient lookups.
 */

import type { Signal, Computed, Effect } from '@lattice/core';
import { ID_PREFIXES } from '../constants';

export type PrimitiveType = 'signal' | 'computed' | 'effect' | 'selector';

export interface TrackedPrimitive {
  readonly id: string;
  readonly name?: string;
  readonly type: PrimitiveType;
  readonly contextId: string;
  readonly createdAt: number;
}

export interface TrackedSignal extends TrackedPrimitive {
  readonly type: 'signal';
  readonly ref: Signal<unknown>;
}

export interface TrackedComputed extends TrackedPrimitive {
  readonly type: 'computed';
  readonly ref: Computed<unknown>;
}

export interface TrackedEffect extends TrackedPrimitive {
  readonly type: 'effect';
  readonly ref: Effect;
}

export interface TrackedSelector extends TrackedPrimitive {
  readonly type: 'selector';
  readonly sourceId: string;
  readonly selector: string;
  readonly ref: unknown; // Selected<T> doesn't have a common base type
}

export type TrackedReactive = TrackedSignal | TrackedComputed | TrackedEffect | TrackedSelector;

/**
 * Primitive registry interface
 */
export interface PrimitiveRegistry {
  generateId(type: PrimitiveType): string;
  registerSignal(signal: Signal<unknown>, contextId: string, name?: string): TrackedSignal;
  registerComputed(computed: Computed<unknown>, contextId: string, name?: string): TrackedComputed;
  registerEffect(effect: Effect, contextId: string, name?: string): TrackedEffect;
  registerSelector(sourceId: string, selector: string, contextId: string, ref: unknown): TrackedSelector;
  get<T extends Signal<unknown> | Computed<unknown> | Effect>(
    ref: T
  ): (T extends Signal<unknown> ? TrackedSignal : T extends Computed<unknown> ? TrackedComputed : TrackedEffect) | undefined;
  getOrRegister<T extends Signal<unknown> | Computed<unknown> | Effect>(
    ref: T,
    contextId: string,
    type: 'signal' | 'computed' | 'effect',
    name?: string
  ): TrackedSignal | TrackedComputed | TrackedEffect;
  getContextPrimitives(contextId: string): Set<TrackedReactive>;
  clearContext(contextId: string): void;
}

/**
 * Creates a registry for managing tracked primitives
 */
export function createPrimitiveRegistry(): PrimitiveRegistry {
  // Private state
  const registry = new WeakMap<
    Signal<unknown> | Computed<unknown> | Effect,
    TrackedSignal | TrackedComputed | TrackedEffect
  >();
  
  const contextPrimitives = new Map<string, Set<TrackedReactive>>();
  let idCounter = 0;

  /**
   * Add primitive to context tracking
   */
  function addToContext(contextId: string, tracked: TrackedReactive): void {
    let contextSet = contextPrimitives.get(contextId);
    if (!contextSet) {
      contextSet = new Set();
      contextPrimitives.set(contextId, contextSet);
    }
    contextSet.add(tracked);
  }

  return {
    generateId(type: PrimitiveType): string {
      const prefix = ID_PREFIXES[type.toUpperCase() as keyof typeof ID_PREFIXES];
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 9);
      return `${prefix}_${timestamp}_${random}_${++idCounter}`;
    },

    registerSignal(
      signal: Signal<unknown>,
      contextId: string,
      name?: string
    ): TrackedSignal {
      const tracked: TrackedSignal = {
        id: this.generateId('signal'),
        name,
        type: 'signal',
        contextId,
        createdAt: Date.now(),
        ref: signal,
      };

      registry.set(signal, tracked);
      addToContext(contextId, tracked);
      
      return tracked;
    },

    registerComputed(
      computed: Computed<unknown>,
      contextId: string,
      name?: string
    ): TrackedComputed {
      const tracked: TrackedComputed = {
        id: this.generateId('computed'),
        name,
        type: 'computed',
        contextId,
        createdAt: Date.now(),
        ref: computed,
      };

      registry.set(computed, tracked);
      addToContext(contextId, tracked);
      
      return tracked;
    },

    registerEffect(
      effect: Effect,
      contextId: string,
      name?: string
    ): TrackedEffect {
      const tracked: TrackedEffect = {
        id: this.generateId('effect'),
        name,
        type: 'effect',
        contextId,
        createdAt: Date.now(),
        ref: effect,
      };

      registry.set(effect, tracked);
      addToContext(contextId, tracked);
      
      return tracked;
    },

    registerSelector(
      sourceId: string,
      selector: string,
      contextId: string,
      ref: unknown
    ): TrackedSelector {
      const tracked: TrackedSelector = {
        id: this.generateId('selector'),
        type: 'selector',
        contextId,
        createdAt: Date.now(),
        sourceId,
        selector,
        ref,
      };

      addToContext(contextId, tracked);
      
      return tracked;
    },

    get<T extends Signal<unknown> | Computed<unknown> | Effect>(
      ref: T
    ): (T extends Signal<unknown> ? TrackedSignal : T extends Computed<unknown> ? TrackedComputed : TrackedEffect) | undefined {
      const tracked = registry.get(ref);
      if (!tracked) return undefined;
      
      // Type narrowing is guaranteed by our registration methods
      return tracked as T extends Signal<unknown> ? TrackedSignal : T extends Computed<unknown> ? TrackedComputed : TrackedEffect;
    },

    getOrRegister<T extends Signal<unknown> | Computed<unknown> | Effect>(
      ref: T,
      contextId: string,
      type: 'signal' | 'computed' | 'effect',
      name?: string
    ): TrackedSignal | TrackedComputed | TrackedEffect {
      const existing = registry.get(ref);
      if (existing) return existing;

      // Register based on type
      if (type === 'signal') {
        return this.registerSignal(ref as Signal<unknown>, contextId, name);
      } else if (type === 'computed') {
        return this.registerComputed(ref as Computed<unknown>, contextId, name);
      } else {
        return this.registerEffect(ref as Effect, contextId, name);
      }
    },

    getContextPrimitives(contextId: string): Set<TrackedReactive> {
      return contextPrimitives.get(contextId) || new Set();
    },

    clearContext(contextId: string): void {
      contextPrimitives.delete(contextId);
    },
  };
}