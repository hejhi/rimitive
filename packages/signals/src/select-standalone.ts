// Standalone select function for fine-grained reactivity
import type { Signal, Computed, Selected } from './types';
import { subscribe } from './subscribe-standalone';

/**
 * Create a derived value with fine-grained updates
 * Only triggers listeners when the selected value actually changes
 * 
 * @param source - The signal or computed to select from
 * @param selector - Function to derive a value from the source
 * @returns A selected object with value getter and subscribe method
 * 
 * @example
 * import { signal } from '@lattice/signals/signal';
 * import { select } from '@lattice/signals/select';
 * 
 * const user = signal({ name: 'John', age: 30 });
 * const name = select(user, u => u.name);
 * 
 * // Only fires when name changes, not age
 * const unsub = subscribe(name, () => console.log('name changed!'));
 */
export function select<T, R>(
  source: Signal<T> | Computed<T>,
  selector: (value: T) => R
): Selected<R> {
  const result: Selected<R> = {
    get value() {
      return selector(source.value);
    },
    
    select<S>(nextSelector: (value: R) => S): Selected<S> {
      return select(source, (value: T) => nextSelector(selector(value)));
    },
    
    _subscribe(listener: () => void) {
      let previousValue = selector(source.value);
      
      return subscribe(source, () => {
        const currentValue = selector(source.peek());
        if (!Object.is(currentValue, previousValue)) {
          listener();
          previousValue = currentValue;
        }
      });
    }
  };
  
  return result;
}