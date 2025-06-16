/**
 * @fileoverview Cross-framework dropdown behavior
 * 
 * This single behavior implementation works across React, Vue, Svelte, and vanilla JS.
 * It handles keyboard navigation, focus management, and accessibility.
 */

import { compose, type CreateStore } from '@lattice/core';

export interface DropdownState {
  isOpen: boolean;
  selectedIndex: number;
  highlightedIndex: number;
  searchQuery: string;
  items: string[];
}

export const createDropdownBehavior = (createStore: CreateStore<DropdownState>) => {
  const createSlice = createStore({
    isOpen: false,
    selectedIndex: -1,
    highlightedIndex: -1,
    searchQuery: '',
    items: []
  });

  // Core dropdown logic
  const dropdown = createSlice(({ get, set }) => ({
    // State getters
    isOpen: () => get().isOpen,
    selectedItem: () => {
      const { selectedIndex, items } = get();
      return selectedIndex >= 0 ? items[selectedIndex] : null;
    },
    highlightedItem: () => {
      const { highlightedIndex, items } = get();
      return highlightedIndex >= 0 ? items[highlightedIndex] : null;
    },
    
    // Core actions
    open: () => {
      set({ 
        isOpen: true, 
        highlightedIndex: get().selectedIndex >= 0 ? get().selectedIndex : 0 
      });
    },
    
    close: () => {
      set({ isOpen: false, searchQuery: '' });
    },
    
    toggle: () => {
      const isOpen = get().isOpen;
      if (isOpen) {
        set({ isOpen: false, searchQuery: '' });
      } else {
        set({ 
          isOpen: true, 
          highlightedIndex: get().selectedIndex >= 0 ? get().selectedIndex : 0 
        });
      }
    },
    
    selectIndex: (index: number) => {
      const items = get().items;
      if (index >= 0 && index < items.length) {
        set({ selectedIndex: index, isOpen: false, searchQuery: '' });
      }
    },
    
    highlightIndex: (index: number) => {
      const items = get().items;
      if (index >= 0 && index < items.length) {
        set({ highlightedIndex: index });
      }
    },
    
    setItems: (items: string[]) => {
      set({ items });
    }
  }));

  // Keyboard navigation
  const navigation = createSlice(({ get, set }) => ({
    handleKeyDown: (event: KeyboardEvent) => {
      const { isOpen, highlightedIndex, items } = get();
      
      switch (event.key) {
        case 'Enter':
        case ' ': // Space
          event.preventDefault();
          if (isOpen && highlightedIndex >= 0) {
            dropdown.selector.selectIndex(highlightedIndex);
          } else if (!isOpen) {
            dropdown.selector.open();
          }
          break;
          
        case 'Escape':
          event.preventDefault();
          dropdown.selector.close();
          break;
          
        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            dropdown.selector.open();
          } else {
            const nextIndex = highlightedIndex < items.length - 1 ? highlightedIndex + 1 : 0;
            set({ highlightedIndex: nextIndex });
          }
          break;
          
        case 'ArrowUp':
          event.preventDefault();
          if (!isOpen) {
            dropdown.selector.open();
          } else {
            const prevIndex = highlightedIndex > 0 ? highlightedIndex - 1 : items.length - 1;
            set({ highlightedIndex: prevIndex });
          }
          break;
          
        case 'Home':
          event.preventDefault();
          if (isOpen && items.length > 0) {
            set({ highlightedIndex: 0 });
          }
          break;
          
        case 'End':
          event.preventDefault();
          if (isOpen && items.length > 0) {
            set({ highlightedIndex: items.length - 1 });
          }
          break;
      }
    }
  }));

  // Search functionality
  const search = createSlice(({ get, set }) => ({
    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },
    
    filteredItems: () => {
      const { items, searchQuery } = get();
      if (!searchQuery) return items;
      
      const query = searchQuery.toLowerCase();
      return items.filter(item => item.toLowerCase().includes(query));
    },
    
    handleSearchKeyDown: (event: KeyboardEvent) => {
      // Delegate navigation keys to navigation handler
      const navigationKeys = ['Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (navigationKeys.includes(event.key)) {
        navigation.selector.handleKeyDown(event);
      }
    }
  }));

  return { dropdown, navigation, search };
};

// Composed version with all features
export const createFullDropdown = (createStore: CreateStore<DropdownState>) => {
  return compose(
    { base: createDropdownBehavior(createStore) },
    ({ get, set }, { base }) => ({
      // Re-export all base functionality
      ...base.dropdown.selector,
      ...base.navigation.selector,
      ...base.search.selector,
      
      // Add convenience methods
      selectItem: (item: string) => {
        const index = get().items.indexOf(item);
        if (index >= 0) {
          base.dropdown.selector.selectIndex(index);
        }
      },
      
      highlightItem: (item: string) => {
        const index = get().items.indexOf(item);
        if (index >= 0) {
          base.dropdown.selector.highlightIndex(index);
        }
      },
      
      reset: () => {
        set({
          isOpen: false,
          selectedIndex: -1,
          highlightedIndex: -1,
          searchQuery: ''
        });
      }
    })
  );
};