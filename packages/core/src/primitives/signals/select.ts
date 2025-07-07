// Selector implementation for fine-grained subscriptions
import type { Signal, Computed } from './types';

export interface Selected<T> {
  readonly value: T;
  subscribe(listener: () => void): () => void;
  select<R>(selector: (value: T) => R): Selected<R>;
}

/**
 * Creates a selected value that only notifies when the selected value actually changes
 * Unlike computed, this runs the selector on every source change but filters notifications
 */
export function createSelectFactory(
  createComputed: <T>(fn: () => T) => Computed<T>,
  subscribe: <T>(source: Signal<T> | Computed<T>, listener: () => void) => () => void
) {
  return function createSelect<T, R>(
    source: Signal<T> | Computed<T>,
    selector: (value: T) => R
  ): Selected<R> {
    const result: Selected<R> = {
      get value() {
        // Always get fresh value when accessed
        return selector(source.value);
      },
      
      subscribe(listener: () => void) {
        let previousValue = selector(source.value);
        
        // Subscribe to ALL source changes
        return subscribe(source, () => {
          const currentValue = selector(source.value);
          
          // Only fire if selected value changed (using Object.is for comparison)
          if (!Object.is(currentValue, previousValue)) {
            listener();
            previousValue = currentValue;
          }
        });
      },
      
      select<S>(nextSelector: (value: R) => S): Selected<S> {
        // Chain selectors by composing them
        return createSelect(source, (value: T) => nextSelector(selector(value)));
      }
    };
    
    return result;
  };
}