import { describe, it } from 'vitest';
import { createComponent, type ComponentFactory } from '@lattice/core';

describe('Test computed lazy initialization', () => {
  const Counter: ComponentFactory<{ count: number }> = ({
    store,
    computed,
    set,
  }) => ({
    value: store.count,
    increment: () => set(store.count, (count) => count + 1),
    isEven: computed(() => {
      console.log('Computing isEven');
      return store.count() % 2 === 0;
    }),
  });

  it('should test lazy initialization', () => {
    const context = createComponent({ count: 0 });
    const counter = Counter(context);

    console.log('Before any access');

    // Subscribe WITHOUT reading first
    let notifyCount = 0;
    const unsubscribe = counter.isEven.subscribe(() => {
      notifyCount++;
      console.log('Notified', notifyCount);
    });

    console.log('After subscribe, before first read');
    console.log('First read:', counter.isEven());

    console.log('About to increment');
    counter.increment();
    console.log('After increment');

    console.log('Final value:', counter.isEven());

    unsubscribe();
  });
});
