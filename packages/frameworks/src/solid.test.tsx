import { describe, it, expect } from 'vitest';
import { createRoot } from 'solid-js';
import type { Signal, Computed, ComponentContext } from '@lattice/core';
import {
  useComponent,
  createLatticeComponent,
  model,
} from './solid';

// Test component factory with proper types
type CounterState = {
  count: number;
}

type CounterComponent = {
  count: Signal<number>;
  doubled: Computed<number>;
  increment: () => void;
  decrement: () => void;
  setCount: (value: number | ((prev: number) => number)) => void;
}

const Counter = ({ store, computed, set }: ComponentContext<CounterState>): CounterComponent => ({
  count: store.count,
  doubled: computed(() => store.count() * 2),
  increment: () => set(store.count, (c) => c + 1),
  decrement: () => set(store.count, (c) => c - 1),
  setCount: (value: number | ((prev: number) => number)) => {
    if (typeof value === 'function') {
      set(store.count, value);
    } else {
      set(store.count, value);
    }
  },
});

describe('Solid bindings', () => {
  describe('useComponent', () => {
    it('creates a component instance', () => {
      createRoot((dispose) => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 0 }, Counter);

        // Test initial values
        expect(counter.count()).toBe(0);
        expect(counter.doubled()).toBe(0);

        // Test methods exist
        expect(typeof counter.increment).toBe('function');
        expect(typeof counter.decrement).toBe('function');
        expect(typeof counter.setCount).toBe('function');

        dispose();
      });
    });

    it('creates isolated instances', () => {
      createRoot((dispose) => {
        const counter1 = useComponent<CounterState, CounterComponent>({ count: 0 }, Counter);
        const counter2 = useComponent<CounterState, CounterComponent>({ count: 10 }, Counter);

        expect(counter1.count()).toBe(0);
        expect(counter2.count()).toBe(10);

        // Test isolation - changing one doesn't affect the other
        counter1.increment();
        expect(counter1.count()).toBe(1);
        expect(counter2.count()).toBe(10);

        dispose();
      });
    });

    it('supports reactive state updates', () => {
      createRoot((dispose) => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 5 }, Counter);

        // Test increment
        counter.increment();
        expect(counter.count()).toBe(6);
        
        // Test decrement
        counter.decrement();
        expect(counter.count()).toBe(5);
        
        // Test setCount with value
        counter.setCount(10);
        expect(counter.count()).toBe(10);
        
        // Test setCount with function
        counter.setCount(prev => prev * 2);
        expect(counter.count()).toBe(20);

        dispose();
      });
    });

    it('supports computed values that update reactively', () => {
      createRoot((dispose) => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 3 }, Counter);

        // Initial computed value
        expect(counter.doubled()).toBe(6);

        // Computed updates when state changes
        counter.increment();
        expect(counter.count()).toBe(4);
        expect(counter.doubled()).toBe(8);

        counter.setCount(10);
        expect(counter.doubled()).toBe(20);

        // Test that computed values are memoized
        const val1 = counter.doubled();
        const val2 = counter.doubled();
        expect(val1).toBe(val2);
        expect(val1).toBe(20);

        dispose();
      });
    });

    it('supports batch updates', () => {
      type MultiState = { x: number; y: number; sum: number };
      type MultiComponent = {
        x: Signal<number>;
        y: Signal<number>;
        sum: Signal<number>;
        total: Computed<number>;
        updateAll: (x: number, y: number) => void;
      };

      createRoot((dispose) => {
        const component = useComponent<MultiState, MultiComponent>(
          { x: 1, y: 2, sum: 3 },
          ({ store, computed, set }) => ({
            x: store.x,
            y: store.y,
            sum: store.sum,
            total: computed(() => store.x() + store.y() + store.sum()),
            updateAll: (x: number, y: number) => {
              set(store, { x, y, sum: x + y });
            },
          })
        );

        expect(component.total()).toBe(6);

        // Batch update
        component.updateAll(10, 20);
        expect(component.x()).toBe(10);
        expect(component.y()).toBe(20);
        expect(component.sum()).toBe(30);
        expect(component.total()).toBe(60);

        dispose();
      });
    });

    it('supports effects API', () => {
      createRoot((dispose) => {
        type EffectState = { value: number; multiplier: number };
        type EffectComponent = {
          value: Signal<number>;
          multiplier: Signal<number>;
          setValue: (v: number) => void;
          setMultiplier: (v: number) => void;
          createTestEffect: () => () => void;
        };

        const component = useComponent<EffectState, EffectComponent>(
          { value: 1, multiplier: 2 },
          ({ store, effect, set }) => {
            // Test that effect function is available
            expect(typeof effect).toBe('function');

            return {
              value: store.value,
              multiplier: store.multiplier,
              setValue: (v: number) => set(store.value, v),
              setMultiplier: (v: number) => set(store.multiplier, v),
              createTestEffect: () => {
                // Create and return a dispose function for an effect
                return effect(() => {
                  // Track dependencies
                  store.value();
                  store.multiplier();
                  
                  // Return cleanup function
                  return () => {
                    // Cleanup logic
                  };
                });
              },
            };
          }
        );

        // Test basic functionality
        expect(component.value()).toBe(1);
        expect(component.multiplier()).toBe(2);
        
        // Test that effect can be created and returns a dispose function
        const effectDispose = component.createTestEffect();
        expect(typeof effectDispose).toBe('function');
        
        // Test cleanup
        effectDispose();
        
        // Change values
        component.setValue(3);
        expect(component.value()).toBe(3);

        dispose();
      });
    });

    it('supports nested reactivity with objects', () => {
      type UserState = { user: { name: string; age: number } };
      type UserComponent = {
        user: Signal<{ name: string; age: number }>;
        userName: Computed<string>;
        updateUser: (updates: Partial<{ name: string; age: number }>) => void;
      };

      createRoot((dispose) => {
        const component = useComponent<UserState, UserComponent>(
          { user: { name: 'John', age: 30 } },
          ({ store, computed, set }) => ({
            user: store.user,
            userName: computed(() => store.user().name),
            updateUser: (updates: Partial<{ name: string; age: number }>) => set(store.user, updates),
          })
        );

        expect(component.user().name).toBe('John');
        expect(component.user().age).toBe(30);
        expect(component.userName()).toBe('John');

        // Partial update
        component.updateUser({ name: 'Jane' });
        expect(component.user().name).toBe('Jane');
        expect(component.user().age).toBe(30);
        expect(component.userName()).toBe('Jane');

        // Update multiple fields
        component.updateUser({ age: 25 });
        expect(component.user().name).toBe('Jane');
        expect(component.user().age).toBe(25);

        dispose();
      });
    });

    it('supports custom signals created within components', () => {
      type CustomState = { base: number };
      type CustomComponent = {
        base: Signal<number>;
        derived: Signal<number>;
        multiplied: Computed<number>;
        increment: () => void;
      };

      createRoot((dispose) => {
        const component = useComponent<CustomState, CustomComponent>(
          { base: 5 },
          ({ store, signal, computed, set }) => {
            const derived = signal(10);

            return {
              base: store.base,
              derived,
              multiplied: computed(() => store.base() * derived()),
              increment: () => {
                set(store.base, b => b + 1);
                set(derived, d => d + 2);
              },
            };
          }
        );

        expect(component.base()).toBe(5);
        expect(component.derived()).toBe(10);
        expect(component.multiplied()).toBe(50);

        component.increment();
        expect(component.base()).toBe(6);
        expect(component.derived()).toBe(12);
        expect(component.multiplied()).toBe(72);

        dispose();
      });
    });
  });


  describe('createLatticeComponent', () => {
    it('creates components outside Solid components', () => {
      const counter = createLatticeComponent<CounterState, CounterComponent>({ count: 5 }, Counter);

      expect(counter.count()).toBe(5);
      expect(counter.doubled()).toBe(10);
      expect(typeof counter.increment).toBe('function');
    });

    it('supports reactive updates in global components', () => {
      createRoot((dispose) => {
        const counter = createLatticeComponent<CounterState, CounterComponent>({ count: 0 }, Counter);
        
        // Test that signals work
        expect(counter.count()).toBe(0);
        
        // Update should work
        counter.increment();
        expect(counter.count()).toBe(1);
        
        counter.setCount(5);
        expect(counter.count()).toBe(5);
        
        // Computed should update
        expect(counter.doubled()).toBe(10);
        
        dispose();
      });
    });
  });

  describe('model', () => {
    it('creates form binding object', () => {
      createRoot((dispose) => {
        type FormState = { email: string; };
        type FormComponent = { email: Signal<string>; setEmail: (v: string) => void; };
        const form = useComponent<FormState, FormComponent>(
          { email: 'test@example.com' },
          ({ store, set }: ComponentContext<FormState>): FormComponent => ({
            email: store.email,
            setEmail: (v: string) => set(store.email, v),
          })
        );

        const emailBinding = model(form.email, form.setEmail);

        expect(emailBinding.value).toBe('test@example.com');
        expect(typeof emailBinding.onInput).toBe('function');

        // Test onInput handler
        const mockEvent = {
          currentTarget: { value: 'new@example.com' }
        } as InputEvent & { currentTarget: HTMLInputElement };
        
        emailBinding.onInput(mockEvent);
        expect(form.email()).toBe('new@example.com');

        dispose();
      });
    });
  });

  describe('signal subscriptions', () => {
    it('provides subscribe method on signals', () => {
      createRoot((dispose) => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 0 }, Counter);
        
        // Test that subscribe method exists
        expect(typeof counter.count.subscribe).toBe('function');
        
        // Test that unsubscribe is returned
        const unsubscribe = counter.count.subscribe(() => {
          // Subscription callback
        });
        expect(typeof unsubscribe).toBe('function');
        
        // Clean up
        unsubscribe();
        dispose();
      });
    });

    it('provides subscribe method on computed values', () => {
      createRoot((dispose) => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 5 }, Counter);
        
        // Test that subscribe method exists
        expect(typeof counter.doubled.subscribe).toBe('function');
        
        // Test that unsubscribe is returned
        const unsubscribe = counter.doubled.subscribe(() => {
          // Subscription callback
        });
        expect(typeof unsubscribe).toBe('function');
        
        // Clean up
        unsubscribe();
        dispose();
      });
    });
  });

  describe('error handling', () => {
    it('throws error when trying to set a computed value', () => {
      createRoot((dispose) => {
        type TestState = { value: number };
        type TestComponent = {
          value: Signal<number>;
          computed: Computed<number>;
          trySetComputed: () => void;
        };
        
        const component = useComponent<TestState, TestComponent>(
          { value: 5 },
          ({ store, computed, set }) => {
            const computedValue = computed(() => store.value() * 2);
            
            return {
              value: store.value,
              computed: computedValue,
              trySetComputed: () => {
                // This should throw an error
                // We're testing that attempting to set a computed value throws
                expect(() => {
                  // Force TypeScript to allow this for testing error handling
                  const unsafeSet = set as unknown as (target: unknown, value: unknown) => void;
                  unsafeSet(computedValue, 100);
                }).toThrow('Cannot set a computed or read-only signal');
              },
            };
          }
        );
        
        component.trySetComputed();
        
        dispose();
      });
    });
  });

  describe('complex state updates', () => {
    it('handles function updates for store', () => {
      createRoot((dispose) => {
        type ComplexState = { x: number; y: number };
        type ComplexComponent = {
          x: Signal<number>;
          y: Signal<number>;
          updateBoth: () => void;
        };
        
        const component = useComponent<ComplexState, ComplexComponent>(
          { x: 1, y: 2 },
          ({ store, set }) => ({
            x: store.x,
            y: store.y,
            updateBoth: () => {
              set(store, (prev) => ({
                x: prev.x * 2,
                y: prev.y * 3,
              }));
            },
          })
        );
        
        expect(component.x()).toBe(1);
        expect(component.y()).toBe(2);
        
        component.updateBoth();
        
        expect(component.x()).toBe(2);
        expect(component.y()).toBe(6);
        
        dispose();
      });
    });

    it('handles undefined and null values correctly', () => {
      createRoot((dispose) => {
        type NullableState = { value: string | null };
        type NullableComponent = {
          value: Signal<string | null>;
          setValue: (v: string | null) => void;
          updateValue: (fn: (prev: string | null) => string | null) => void;
        };
        
        const component = useComponent<NullableState, NullableComponent>(
          { value: null },
          ({ store, set }) => ({
            value: store.value,
            setValue: (v: string | null) => set(store.value, v),
            updateValue: (fn: (prev: string | null) => string | null) => set(store.value, fn),
          })
        );
        
        expect(component.value()).toBe(null);
        
        component.setValue('hello');
        expect(component.value()).toBe('hello');
        
        component.setValue(null);
        expect(component.value()).toBe(null);
        
        component.updateValue((prev) => prev === null ? 'default' : prev);
        expect(component.value()).toBe('default');
        
        dispose();
      });
    });
  });
});