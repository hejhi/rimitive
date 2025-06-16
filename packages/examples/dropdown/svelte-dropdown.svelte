<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { createSvelteAdapter } from '@lattice/adapter-svelte';
  import { sliceValues } from '@lattice/runtime/svelte';
  import { createFullDropdown } from './dropdown-behavior';

  // Props
  export let items = [
    'React', 'Vue', 'Svelte', 'Angular', 'Solid', 
    'Preact', 'Alpine', 'Lit', 'Ember', 'Backbone'
  ];
  export let placeholder = 'Choose a framework...';
  export let onSelect = (item) => console.log('Selected:', item);

  // Create the same dropdown store as React and Vue
  const dropdownStore = createSvelteAdapter(createFullDropdown);

  // Get reactive values - Svelte stores!
  const { isOpen, selectedItem, highlightedIndex, searchQuery, filteredItems } = 
    sliceValues(dropdownStore);

  // Element refs
  let dropdownRef;
  let searchInput;

  // Initialize items
  onMount(() => {
    dropdownStore.actions.setItems(items);
  });

  // Update items when prop changes
  $: dropdownStore.actions.setItems(items);

  // Handle clicks outside
  function handleClickOutside(event) {
    if (dropdownRef && !dropdownRef.contains(event.target)) {
      dropdownStore.actions.close();
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    dropdownStore.destroy();
  });

  // Focus search input when opened
  $: if ($isOpen && searchInput) {
    tick().then(() => searchInput?.focus());
  }

  // Handle selection
  function handleSelect(index) {
    dropdownStore.actions.selectIndex(index);
    const selected = $filteredItems[index];
    if (onSelect && selected) {
      onSelect(selected);
    }
  }
</script>

<div class="demo-container">
  <h2>Svelte Dropdown Example</h2>
  <p>Same behavior, now in Svelte with reactive stores!</p>
  
  <div class="dropdown-container" bind:this={dropdownRef}>
    <div class="dropdown-trigger">
      <button
        on:click={() => dropdownStore.actions.toggle()}
        on:keydown={(e) => dropdownStore.actions.handleKeyDown(e)}
        class="dropdown-button"
        aria-haspopup="listbox"
        aria-expanded={$isOpen}
      >
        <span>{$selectedItem || placeholder}</span>
        <svg class="dropdown-arrow" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </button>
    </div>
    
    {#if $isOpen}
      <div class="dropdown-menu" role="listbox">
        <div class="dropdown-search">
          <input
            bind:this={searchInput}
            type="text"
            placeholder="Search..."
            value={$searchQuery}
            on:input={(e) => dropdownStore.actions.setSearchQuery(e.target.value)}
            on:keydown={(e) => dropdownStore.actions.handleSearchKeyDown(e)}
            class="dropdown-search-input"
          />
        </div>
        
        <ul class="dropdown-list">
          {#each $filteredItems as item, index}
            <li
              role="option"
              aria-selected={$selectedItem === item}
              class="dropdown-item"
              class:highlighted={$highlightedIndex === index}
              class:selected={$selectedItem === item}
              on:mouseenter={() => dropdownStore.actions.highlightIndex(index)}
              on:click={() => handleSelect(index)}
            >
              {item}
            </li>
          {/each}
          {#if $filteredItems.length === 0}
            <li class="dropdown-empty">No items found</li>
          {/if}
        </ul>
      </div>
    {/if}
  </div>
  
  <div class="demo-features">
    <h3>Features:</h3>
    <ul>
      <li>✅ Exact same behavior as React & Vue</li>
      <li>✅ Uses Svelte's reactive stores</li>
      <li>✅ Optimized adapter (3x faster!)</li>
      <li>✅ Full TypeScript support</li>
      <li>✅ One behavior, three frameworks</li>
    </ul>
  </div>
</div>

<style>
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