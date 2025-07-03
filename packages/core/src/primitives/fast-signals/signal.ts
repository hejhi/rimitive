// Signal implementation

import type { Signal } from './types';
import { RUNNING } from './types';
import { addDependency, notifyTargets } from './node';
import {
  getCurrentComputed,
  incrementGlobalVersion,
  setCurrentComputed,
} from './global';
import { getBatchDepth } from './batch';

export function signal<T>(value: T): Signal<T> {
  const s: Signal<T> = function (newValue?: T) {
    if (arguments.length === 0) {
      // Read path
      const current = getCurrentComputed();
      if (current && current._flags & RUNNING) {
        addDependency(s, current);
      }
      return s._value;
    } else {
      // Write path
      if (s._value !== newValue) {
        s._value = newValue!;
        s._version++;
        incrementGlobalVersion();

        if (!getBatchDepth()) {
          notifyTargets(s);
        } else {
          // In batch - just mark targets as outdated
          let node = s._targets;
          while (node) {
            node.target._notify();
            node = node.nextTarget;
          }
        }
      }
    }
    return undefined;
  } as Signal<T>;

  s._value = value;
  s._version = 0;

  return s;
}

// Utility functions for signals
export function peek<T>(signal: Signal<T>): T {
  return signal._value;
}

export function untrack<T>(fn: () => T): T {
  const prev = getCurrentComputed();
  try {
    // Temporarily disable tracking
    setCurrentComputed(null);
    return fn();
  } finally {
    setCurrentComputed(prev);
  }
}
