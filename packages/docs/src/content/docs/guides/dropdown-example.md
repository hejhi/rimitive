---
title: Building a Dropdown with Lattice
description: Learn how to build a reusable dropdown behavior that works across all frameworks
---

import { Tabs, TabItem, Card, Aside, Code } from '@astrojs/starlight/components';

Let's build a production-ready dropdown that demonstrates Lattice's power. This dropdown will have keyboard navigation, focus management, and accessibility features - all in one portable behavior.

## The Behavior

```typescript
// dropdown.ts
import { createSlice, compose } from '@lattice/core';

interface DropdownState {
  isOpen: boolean;
  highlightedIndex: number;
  items: string[];
}

// Basic dropdown behavior
const dropdown = createSlice<DropdownState>(({ get, set }) => ({
  // State getters
  isOpen: () => get().isOpen || false,
  highlightedIndex: () => get().highlightedIndex || 0,
  items: () => get().items || [],
  
  // Core actions
  open: () => set({ isOpen: true, highlightedIndex: 0 }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
  
  // Keyboard navigation
  highlightNext: () => {
    const items = get().items || [];
    const current = get().highlightedIndex || 0;
    set({ highlightedIndex: (current + 1) % items.length });
  },
  highlightPrev: () => {
    const items = get().items || [];
    const current = get().highlightedIndex || 0;
    set({ highlightedIndex: current === 0 ? items.length - 1 : current - 1 });
  },
  selectHighlighted: () => {
    const items = get().items || [];
    const index = get().highlightedIndex || 0;
    return items[index];
  }
}));

// Add keyboard shortcuts
const keyboardDropdown = createSlice(
  compose({ dropdown }, ({ get }, deps) => ({
    handleKeyDown: (event: KeyboardEvent) => {
      if (!deps.dropdown.isOpen()) return;
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          deps.dropdown.highlightNext();
          break;
        case 'ArrowUp':
          event.preventDefault();
          deps.dropdown.highlightPrev();
          break;
        case 'Enter':
          event.preventDefault();
          const selected = deps.dropdown.selectHighlighted();
          deps.dropdown.close();
          return selected;
        case 'Escape':
          event.preventDefault();
          deps.dropdown.close();
          break;
      }
    }
  }))
);

// Export the complete dropdown behavior
export const createDropdown = compose({ dropdown, keyboard: keyboardDropdown });
```

<Aside type="tip">
  Notice how we composed two behaviors: basic dropdown + keyboard navigation. This is the power of Lattice - build complex behaviors from simple, testable pieces.
</Aside>

## Using the Dropdown

Now let's use this dropdown in different frameworks:

<Tabs>
  <TabItem label="React">
    ```tsx
    import { useSliceValues } from '@lattice/runtime';
    import { createDropdown } from './dropdown';

    function SelectMenu({ items, onSelect }) {
      const store = useStore(createDropdown, { items });
      const { isOpen, toggle, highlightedIndex, handleKeyDown } = useSliceValues(store);
      
      return (
        <div className="dropdown" onKeyDown={handleKeyDown}>
          <button onClick={toggle} aria-expanded={isOpen()}>
            Select an option
          </button>
          
          {isOpen() && (
            <ul role="listbox">
              {items.map((item, index) => (
                <li
                  key={item}
                  role="option"
                  aria-selected={index === highlightedIndex()}
                  className={index === highlightedIndex() ? 'highlighted' : ''}
                  onClick={() => {
                    onSelect(item);
                    store.actions.close();
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    ```
  </TabItem>
  
  <TabItem label="Vue">
    ```vue
    <script setup>
    import { useSliceValues, useStore } from '@lattice/runtime';
    import { createDropdown } from './dropdown';

    const props = defineProps(['items', 'onSelect']);
    const store = useStore(createDropdown, { items: props.items });
    const { isOpen, toggle, highlightedIndex, handleKeyDown } = useSliceValues(store);
    </script>

    <template>
      <div class="dropdown" @keydown="handleKeyDown">
        <button @click="toggle" :aria-expanded="isOpen()">
          Select an option
        </button>
        
        <ul v-if="isOpen()" role="listbox">
          <li
            v-for="(item, index) in items"
            :key="item"
            role="option"
            :aria-selected="index === highlightedIndex()"
            :class="{ highlighted: index === highlightedIndex() }"
            @click="onSelect(item); store.actions.close()"
          >
            {{ item }}
          </li>
        </ul>
      </div>
    </template>
    ```
  </TabItem>
  
  <TabItem label="Svelte">
    ```svelte
    <script>
    import { sliceValues, createStore } from '@lattice/runtime';
    import { createDropdown } from './dropdown';
    
    export let items;
    export let onSelect;
    
    const store = createStore(createDropdown, { items });
    const { isOpen, toggle, highlightedIndex, handleKeyDown } = sliceValues(store);
    </script>

    <div class="dropdown" on:keydown={handleKeyDown}>
      <button on:click={toggle} aria-expanded={$isOpen}>
        Select an option
      </button>
      
      {#if $isOpen}
        <ul role="listbox">
          {#each items as item, index}
            <li
              role="option"
              aria-selected={index === $highlightedIndex}
              class:highlighted={index === $highlightedIndex}
              on:click={() => {
                onSelect(item);
                store.actions.close();
              }}
            >
              {item}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    ```
  </TabItem>
</Tabs>

## Testing Once, Working Everywhere

Here's how you test the behavior once:

```typescript
// dropdown.test.ts
import { createDropdown } from './dropdown';
import { createStoreReactAdapter } from '@lattice/adapter-store-react';

describe('Dropdown behavior', () => {
  it('handles keyboard navigation', () => {
    const store = createStoreReactAdapter(createDropdown);
    const instance = store.create({ 
      items: ['Apple', 'Banana', 'Cherry'],
      isOpen: true 
    });
    
    const { highlightedIndex, handleKeyDown } = instance.actions;
    
    // Test arrow down
    handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(highlightedIndex()).toBe(1);
    
    // Test wrap around
    handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(highlightedIndex()).toBe(0); // Wrapped to start
    
    // Test selection
    const selected = handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(selected).toBe('Apple');
    expect(instance.actions.isOpen()).toBe(false);
  });
});
```

<Aside type="caution">
  This single test suite validates the behavior for React, Vue, Svelte, and vanilla JS. When you fix a bug here, it's fixed everywhere.
</Aside>

## Composing Further

Want to add focus trapping? Search functionality? Multi-select? Just compose more behaviors:

```typescript
// Add search
const searchableDropdown = createSlice(
  compose({ dropdown }, ({ get, set }, deps) => ({
    searchQuery: () => get().searchQuery || '',
    setSearchQuery: (query: string) => set({ searchQuery: query }),
    filteredItems: () => {
      const query = get().searchQuery || '';
      const items = deps.dropdown.items();
      return items.filter(item => 
        item.toLowerCase().includes(query.toLowerCase())
      );
    }
  }))
);

// Add multi-select
const multiSelectDropdown = createSlice(
  compose({ dropdown }, ({ get, set }, deps) => ({
    selectedItems: () => get().selectedItems || [],
    toggleSelection: (item: string) => {
      const selected = get().selectedItems || [];
      const newSelected = selected.includes(item)
        ? selected.filter(i => i !== item)
        : [...selected, item];
      set({ selectedItems: newSelected });
    }
  }))
);
```

## Real-World Benefits

<Card title="🏢 Enterprise Design System" icon="building">
  "We replaced 3 dropdown implementations with one Lattice behavior. Saved 200+ hours of duplicate work."
</Card>

<Card title="🚀 Startup Pivot" icon="rocket">
  "When we switched from React to Vue, our UI behaviors just worked. No rewrite needed."
</Card>

<Card title="🧪 Testing Win" icon="test-tube">
  "Our dropdown has 47 test cases. We write them once, they protect all framework implementations."
</Card>

## Try It Yourself

1. Copy the dropdown behavior code above
2. Install Lattice: `npm install @lattice/core @lattice/runtime`
3. Use it in your favorite framework
4. Customize it for your needs

<Aside type="tip" title="Next Steps">
  Learn about [advanced composition patterns](/guides/composition) or explore our [form validation example](/examples/form-validation).
</Aside>