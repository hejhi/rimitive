<script>
  import { createSvelteAdapter } from '@lattice/adapter-svelte';
  import { sliceValue, sliceValues } from '@lattice/runtime/svelte';
  
  // Define your component with Lattice
  const createTodoComponent = (createStore) => {
    const createSlice = createStore({ 
      todos: [],
      filter: 'all' // 'all' | 'active' | 'completed'
    });
    
    const todos = createSlice(({ get, set }) => ({
      items: () => get().todos,
      add: (text) => {
        const newTodo = { id: Date.now(), text, done: false };
        set({ todos: [...get().todos, newTodo] });
      },
      toggle: (id) => {
        set({
          todos: get().todos.map(todo =>
            todo.id === id ? { ...todo, done: !todo.done } : todo
          )
        });
      },
      remove: (id) => {
        set({ todos: get().todos.filter(todo => todo.id !== id) });
      }
    }));
    
    const filter = createSlice(({ get, set }) => ({
      value: () => get().filter,
      set: (filter) => set({ filter })
    }));
    
    const filtered = createSlice(({ get }) => ({
      items: () => {
        const items = get().todos;
        const filterValue = get().filter;
        
        switch (filterValue) {
          case 'active':
            return items.filter(todo => !todo.done);
          case 'completed':
            return items.filter(todo => todo.done);
          default:
            return items;
        }
      },
      counts: () => {
        const items = get().todos;
        return {
          total: items.length,
          active: items.filter(t => !t.done).length,
          completed: items.filter(t => t.done).length
        };
      }
    }));
    
    return { todos, filter, filtered };
  };
  
  // Create the store
  const store = createSvelteAdapter(createTodoComponent);
  
  // Create reactive values using Lattice runtime utilities
  const filteredTodos = sliceValue(store, s => s.filtered.items());
  const counts = sliceValue(store, s => s.filtered.counts());
  const currentFilter = sliceValue(store, s => s.filter.value());
  
  // Or use sliceValues for multiple values at once
  const values = sliceValues(store, {
    todos: s => s.filtered.items(),
    filter: s => s.filter.value(),
    counts: s => s.filtered.counts()
  });
  
  let newTodoText = '';
  
  function addTodo() {
    if (newTodoText.trim()) {
      store.todos.add(newTodoText.trim());
      newTodoText = '';
    }
  }
  
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      addTodo();
    }
  }
</script>

<div class="todo-app">
  <h1>Lattice + Svelte Todo App</h1>
  
  <div class="input-group">
    <input
      bind:value={newTodoText}
      on:keydown={handleKeydown}
      placeholder="What needs to be done?"
    />
    <button on:click={addTodo}>Add</button>
  </div>
  
  <div class="filters">
    <button 
      class:active={$currentFilter === 'all'}
      on:click={() => store.filter.set('all')}
    >
      All ({$counts.total})
    </button>
    <button 
      class:active={$currentFilter === 'active'}
      on:click={() => store.filter.set('active')}
    >
      Active ({$counts.active})
    </button>
    <button 
      class:active={$currentFilter === 'completed'}
      on:click={() => store.filter.set('completed')}
    >
      Completed ({$counts.completed})
    </button>
  </div>
  
  <ul class="todo-list">
    {#each $filteredTodos as todo (todo.id)}
      <li class:completed={todo.done}>
        <input
          type="checkbox"
          checked={todo.done}
          on:change={() => store.todos.toggle(todo.id)}
        />
        <span>{todo.text}</span>
        <button on:click={() => store.todos.remove(todo.id)}>×</button>
      </li>
    {/each}
  </ul>
  
  {#if $filteredTodos.length === 0}
    <p class="empty">
      {#if $currentFilter === 'all'}
        No todos yet. Add one above!
      {:else if $currentFilter === 'active'}
        No active todos.
      {:else}
        No completed todos.
      {/if}
    </p>
  {/if}
</div>

<style>
  .todo-app {
    max-width: 500px;
    margin: 2rem auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  h1 {
    text-align: center;
    color: #333;
    margin-bottom: 2rem;
  }
  
  .input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  input[type="text"] {
    flex: 1;
    padding: 0.75rem;
    font-size: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  button {
    padding: 0.75rem 1rem;
    font-size: 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #0056b3;
  }
  
  .filters {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .filters button {
    background: #f8f9fa;
    color: #333;
    flex: 1;
  }
  
  .filters button.active {
    background: #007bff;
    color: white;
  }
  
  .todo-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .todo-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
  }
  
  .todo-list li.completed span {
    text-decoration: line-through;
    opacity: 0.6;
  }
  
  .todo-list li span {
    flex: 1;
  }
  
  .todo-list li button {
    background: #dc3545;
    padding: 0.25rem 0.5rem;
    font-size: 1.2rem;
    line-height: 1;
  }
  
  .todo-list li button:hover {
    background: #c82333;
  }
  
  input[type="checkbox"] {
    width: 1.2rem;
    height: 1.2rem;
    cursor: pointer;
  }
  
  .empty {
    text-align: center;
    color: #666;
    font-style: italic;
    margin-top: 2rem;
  }
</style>