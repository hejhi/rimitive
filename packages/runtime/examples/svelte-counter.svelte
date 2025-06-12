<!--
  Example: Svelte Counter with Lattice
  
  This example shows how to use the Svelte adapter with Lattice
  to create reactive components with portable state logic.
-->
<script lang="ts">
  import { derived } from 'svelte/store';
  import { createSvelteAdapter } from '@lattice/adapter-svelte';
  import { compose } from '@lattice/core';
  import type { CreateStore } from '@lattice/core';

  // Define the component with portable logic
  const createCounterComponent = (createStore: CreateStore<{
    count: number;
    step: number;
    history: number[];
  }>) => {
    const createSlice = createStore({ 
      count: 0, 
      step: 1,
      history: []
    });
    
    // Basic counter slice
    const counter = createSlice(({ get, set }) => ({
      value: () => get().count,
      increment: () => {
        const newCount = get().count + get().step;
        set({ 
          count: newCount,
          history: [...get().history, newCount]
        });
      },
      decrement: () => {
        const newCount = get().count - get().step;
        set({ 
          count: newCount,
          history: [...get().history, newCount]
        });
      },
      reset: () => set({ count: 0, history: [0] })
    }));
    
    // Settings slice
    const settings = createSlice(({ get, set }) => ({
      step: () => get().step,
      setStep: (step: number) => set({ step })
    }));
    
    // Stats slice using compose for dependencies
    const stats = createSlice(
      compose({ counter }, (_, { counter }) => ({
        history: () => get().history,
        max: () => Math.max(...get().history, 0),
        min: () => Math.min(...get().history, 0),
        average: () => {
          const hist = get().history;
          return hist.length > 0 
            ? hist.reduce((a, b) => a + b, 0) / hist.length 
            : 0;
        }
      }))
    );
    
    return { counter, settings, stats };
  };

  // Create the Lattice store with Svelte adapter
  const store = createSvelteAdapter(createCounterComponent);
  
  // Create reactive Svelte stores for UI binding
  const count = derived(store, () => store.counter.value());
  const step = derived(store, () => store.settings.step());
  const stats = derived(store, () => ({
    max: store.stats.max(),
    min: store.stats.min(),
    average: store.stats.average(),
    history: store.stats.history()
  }));
  
  // Local UI state
  let showStats = false;
</script>

<main>
  <h1>Svelte + Lattice Counter</h1>
  
  <div class="counter">
    <button on:click={store.counter.decrement}>
      - {$step}
    </button>
    
    <span class="count">{$count}</span>
    
    <button on:click={store.counter.increment}>
      + {$step}
    </button>
  </div>
  
  <div class="controls">
    <label>
      Step: 
      <input 
        type="number" 
        value={$step}
        on:input={(e) => store.settings.setStep(Number(e.target.value))}
        min="1"
        max="10"
      />
    </label>
    
    <button on:click={store.counter.reset}>Reset</button>
    
    <button on:click={() => showStats = !showStats}>
      {showStats ? 'Hide' : 'Show'} Stats
    </button>
  </div>
  
  {#if showStats}
    <div class="stats">
      <h2>Statistics</h2>
      <p>Max: {$stats.max}</p>
      <p>Min: {$stats.min}</p>
      <p>Average: {$stats.average.toFixed(2)}</p>
      <p>History: {$stats.history.join(', ')}</p>
    </div>
  {/if}
</main>

<style>
  main {
    text-align: center;
    padding: 2rem;
    font-family: sans-serif;
  }
  
  .counter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin: 2rem 0;
  }
  
  .count {
    font-size: 3rem;
    font-weight: bold;
    min-width: 100px;
  }
  
  button {
    font-size: 1.2rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    border: 2px solid #333;
    background: white;
    border-radius: 4px;
    transition: background 0.2s;
  }
  
  button:hover {
    background: #f0f0f0;
  }
  
  button:active {
    background: #e0e0e0;
  }
  
  .controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .controls label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  input[type="number"] {
    width: 60px;
    padding: 0.25rem;
    font-size: 1rem;
  }
  
  .stats {
    margin-top: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #f9f9f9;
  }
  
  .stats h2 {
    margin-top: 0;
  }
  
  .stats p {
    margin: 0.5rem 0;
  }
</style>