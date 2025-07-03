// Effect implementation

import type { Effect } from './types';
import { NOTIFIED, OUTDATED, RUNNING, DISPOSED } from './types';
import { prepareSources, cleanupSources, disposeComputed } from './node';
import { setCurrentComputed, getCurrentComputed } from './global';
import { getBatchDepth, addToBatch } from './batch';

export function effect(fn: () => void): () => void {
  const e: Effect = {
    _fn: fn,
    _flags: OUTDATED,
    
    _notify() {
      if (!(e._flags & NOTIFIED)) {
        e._flags |= NOTIFIED | OUTDATED;
        if (!getBatchDepth()) {
          e._run();
        } else {
          addToBatch(e);
        }
      }
    },
    
    _run() {
      if (e._flags & DISPOSED) return;
      if (e._flags & RUNNING) return;
      
      e._flags |= RUNNING;
      e._flags &= ~(NOTIFIED | OUTDATED);
      
      prepareSources(e);
      
      const prevComputed = getCurrentComputed();
      setCurrentComputed(e);
      
      try {
        e._fn();
      } finally {
        setCurrentComputed(prevComputed);
        e._flags &= ~RUNNING;
      }
      
      cleanupSources(e);
    },
    
    dispose() {
      if (!(e._flags & DISPOSED)) {
        e._flags |= DISPOSED;
        disposeComputed(e);
      }
    }
  };
  
  // Run immediately
  e._run();
  
  // Return dispose function
  return () => e.dispose();
}

// Create an effect that runs once
export function runOnce(fn: () => void): void {
  const dispose = effect(fn);
  dispose();
}

// Create an effect with error handling
export function safeEffect(
  fn: () => void,
  onError?: (error: unknown) => void
): () => void {
  return effect(() => {
    try {
      fn();
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        console.error('Effect error:', error);
      }
    }
  });
}