import { describe, it, expect } from 'vitest';
import { merge } from './merge';
import { compose } from './compose';
import { defineModule } from './module';

describe('merge()', () => {
  it('should merge additional properties into a Use context', () => {
    const Counter = defineModule({
      name: 'counter',
      create: () => ({ count: 0 }),
    });

    const use = compose(Counter);
    const merged = merge(use, { theme: 'dark' });

    // Original properties preserved
    expect(merged.counter).toBe(use.counter);
    // New property added
    expect(merged.theme).toBe('dark');
  });

  it('should allow overriding existing properties', () => {
    const Counter = defineModule({
      name: 'counter',
      create: () => ({ count: 0 }),
    });

    const use = compose(Counter);
    const customCounter = { count: 100 };
    const merged = merge(use, { counter: customCounter });

    // Property is overridden
    expect(merged.counter).toBe(customCounter);
    expect(merged.counter.count).toBe(100);
  });

  it('should preserve base service instances', () => {
    const state = { value: 0 };
    const Signal = defineModule({
      name: 'signal',
      create: () => () => state,
    });

    const use = compose(Signal);
    const merged = merge(use, { extra: 'data' });

    expect(merged.signal).toBe(use.signal);
  });

  it('should be callable with portables', () => {
    const Counter = defineModule({
      name: 'counter',
      create: () => () => 42,
    });

    const use = compose(Counter);
    const merged = merge(use, { multiplier: 2 });

    // Can call merged with a function
    const result = merged((svc) => svc.counter() * svc.multiplier);
    expect(result).toBe(84);
  });

  it('should support chaining multiple merges', () => {
    const Base = defineModule({
      name: 'base',
      create: () => 'base',
    });

    const use = compose(Base);
    const withTheme = merge(use, { theme: 'dark' });
    const withRouter = merge(withTheme, { route: '/home' });

    expect(withRouter.base).toBe('base');
    expect(withRouter.theme).toBe('dark');
    expect(withRouter.route).toBe('/home');
  });
});
