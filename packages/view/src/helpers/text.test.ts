import { describe, it, expect } from 'vitest';
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { createText } from './text';

describe('createText', () => {
  it('should create reactive text from template literal', () => {
    const { signal, computed } = createSignalsSvc();
    const t = createText(computed);

    const count = signal(0);
    const text = t`Count: ${count}`;

    expect(text()).toBe('Count: 0');

    count(5);
    expect(text()).toBe('Count: 5');
  });

  it('should handle multiple interpolations', () => {
    const { signal, computed } = createSignalsSvc();
    const t = createText(computed);

    const name = signal('World');
    const count = signal(42);
    const text = t`Hello ${name}, you have ${count} messages`;

    expect(text()).toBe('Hello World, you have 42 messages');

    name('Alice');
    count(10);
    expect(text()).toBe('Hello Alice, you have 10 messages');
  });

  it('should handle computeds as interpolations', () => {
    const { signal, computed } = createSignalsSvc();
    const t = createText(computed);

    const count = signal(5);
    const doubled = computed(() => count() * 2);
    const text = t`Count: ${count} (doubled: ${doubled})`;

    expect(text()).toBe('Count: 5 (doubled: 10)');

    count(7);
    expect(text()).toBe('Count: 7 (doubled: 14)');
  });

  it('should handle static values', () => {
    const { signal, computed } = createSignalsSvc();
    const t = createText(computed);

    const name = signal('World');
    const text = t`Hello ${name}, today is ${'Monday'}`;

    expect(text()).toBe('Hello World, today is Monday');

    name('Alice');
    expect(text()).toBe('Hello Alice, today is Monday');
  });

  it('should handle null and undefined values', () => {
    const { signal, computed } = createSignalsSvc();
    const t = createText(computed);

    const value = signal<string | null>(null);
    const text = t`Value: ${value}`;

    expect(text()).toBe('Value: ');

    value('hello');
    expect(text()).toBe('Value: hello');

    value(null);
    expect(text()).toBe('Value: ');
  });

  it('should handle numbers and booleans', () => {
    const { signal, computed } = createSignalsSvc();
    const t = createText(computed);

    const num = signal(42);
    const bool = signal(true);
    const text = t`Number: ${num}, Boolean: ${bool}`;

    expect(text()).toBe('Number: 42, Boolean: true');

    num(0);
    bool(false);
    expect(text()).toBe('Number: 0, Boolean: false');
  });

  it('should handle empty template', () => {
    const { computed } = createSignalsSvc();
    const t = createText(computed);

    const text = t``;
    expect(text()).toBe('');
  });

  it('should handle template with no interpolations', () => {
    const { computed } = createSignalsSvc();
    const t = createText(computed);

    const text = t`Hello World`;
    expect(text()).toBe('Hello World');
  });
});
