<template>
  <div class="demo-container">
    <h2>Vue Dropdown Example</h2>
    <p>The exact same behavior as React, but in Vue!</p>
    
    <div class="dropdown-container" ref="dropdownRef">
      <div class="dropdown-trigger">
        <button
          @click="store.actions.toggle"
          @keydown="store.actions.handleKeyDown"
          class="dropdown-button"
          :aria-haspopup="'listbox'"
          :aria-expanded="isOpen"
        >
          <span>{{ selectedItem || placeholder }}</span>
          <svg class="dropdown-arrow" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>
      
      <div v-if="isOpen" class="dropdown-menu" role="listbox">
        <div class="dropdown-search">
          <input
            ref="searchInput"
            type="text"
            placeholder="Search..."
            :value="searchQuery"
            @input="store.actions.setSearchQuery($event.target.value)"
            @keydown="store.actions.handleSearchKeyDown"
            class="dropdown-search-input"
          />
        </div>
        
        <ul class="dropdown-list">
          <li
            v-for="(item, index) in filteredItems"
            :key="item"
            role="option"
            :aria-selected="selectedItem === item"
            :class="[
              'dropdown-item',
              { highlighted: highlightedIndex === index },
              { selected: selectedItem === item }
            ]"
            @mouseenter="store.actions.highlightIndex(index)"
            @click="handleSelect(index)"
          >
            {{ item }}
          </li>
          <li v-if="filteredItems.length === 0" class="dropdown-empty">
            No items found
          </li>
        </ul>
      </div>
    </div>
    
    <div class="demo-features">
      <h3>Features:</h3>
      <ul>
        <li>✅ Same keyboard navigation as React</li>
        <li>✅ Same search functionality</li>
        <li>✅ Same accessibility features</li>
        <li>✅ Same behavior, different framework!</li>
        <li>✅ Zero behavior code duplication</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { createPiniaAdapter } from '@lattice/adapter-pinia';
import { useSliceValues } from '@lattice/frameworks/vue';
import { createFullDropdown } from './dropdown-behavior';

// Props
const props = defineProps({
  items: {
    type: Array,
    default: () => [
      'React', 'Vue', 'Svelte', 'Angular', 'Solid', 
      'Preact', 'Alpine', 'Lit', 'Ember', 'Backbone'
    ]
  },
  placeholder: {
    type: String,
    default: 'Choose a framework...'
  },
  onSelect: {
    type: Function,
    default: (item) => console.log('Selected:', item)
  }
});

// Create the same dropdown store as React
const dropdownStore = createPiniaAdapter(createFullDropdown);

// Get reactive values
const { isOpen, selectedItem, highlightedIndex, searchQuery, filteredItems } = 
  useSliceValues(dropdownStore);

// Template refs
const dropdownRef = ref(null);
const searchInput = ref(null);

// Initialize items
onMounted(() => {
  dropdownStore.actions.setItems(props.items);
});

// Watch for item changes
watch(() => props.items, (newItems) => {
  dropdownStore.actions.setItems(newItems);
});

// Handle clicks outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    dropdownStore.actions.close();
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});

// Focus search input when opened
watch(isOpen, async (newIsOpen) => {
  if (newIsOpen) {
    await nextTick();
    searchInput.value?.focus();
  }
});

// Handle selection
const handleSelect = (index) => {
  dropdownStore.actions.selectIndex(index);
  const selected = filteredItems.value[index];
  if (props.onSelect && selected) {
    props.onSelect(selected);
  }
};

// Expose store for debugging
const store = dropdownStore;
</script>

<style scoped>
.demo-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.dropdown-container {
  position: relative;
  width: 100%;
}

.dropdown-button {
  width: 100%;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.dropdown-button:hover {
  border-color: #cbd5e0;
}

.dropdown-button:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.dropdown-arrow {
  width: 1.25rem;
  height: 1.25rem;
  color: #718096;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dropdown-search {
  padding: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.dropdown-search-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.dropdown-search-input:focus {
  outline: none;
  border-color: #4299e1;
}

.dropdown-list {
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  overflow-y: auto;
  flex: 1;
}

.dropdown-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.15s;
}

.dropdown-item:hover,
.dropdown-item.highlighted {
  background: #f7fafc;
}

.dropdown-item.selected {
  background: #e6fffa;
  color: #047857;
  font-weight: 500;
}

.dropdown-empty {
  padding: 1rem;
  text-align: center;
  color: #718096;
}

.demo-features {
  margin-top: 2rem;
  padding: 1rem;
  background: #f7fafc;
  border-radius: 0.375rem;
}

.demo-features h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #2d3748;
}

.demo-features ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #4a5568;
}

.demo-features li {
  margin: 0.25rem 0;
}
</style>