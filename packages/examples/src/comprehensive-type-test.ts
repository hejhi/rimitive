import { createComponent, createModel, createSlice, select } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Create a complex component with various features
const todoApp = createComponent(() => {
  interface Todo {
    id: number;
    text: string;
    completed: boolean;
  }

  const model = createModel(({ set, get }) => ({
    todos: [] as Todo[],
    filter: 'all' as 'all' | 'active' | 'completed',
    searchQuery: '',
    
    addTodo: (text: string) => {
      const newTodo: Todo = {
        id: Date.now(),
        text,
        completed: false
      };
      set({ todos: [...get().todos, newTodo] });
    },
    
    toggleTodo: (id: number) => {
      set({
        todos: get().todos.map(todo =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      });
    },
    
    removeTodo: (id: number) => {
      set({ todos: get().todos.filter(todo => todo.id !== id) });
    },
    
    setFilter: (filter: 'all' | 'active' | 'completed') => {
      set({ filter });
    },
    
    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    }
  }));

  // Actions slice
  const actions = createSlice(model, (m) => ({
    addTodo: m.addTodo,
    toggleTodo: m.toggleTodo,
    removeTodo: m.removeTodo,
    setFilter: m.setFilter,
    setSearchQuery: m.setSearchQuery
  }));

  // State slice for computations
  const todoState = createSlice(model, (m) => ({
    todos: m.todos,
    filter: m.filter,
    searchQuery: m.searchQuery
  }));

  // Stats slice
  const statsSlice = createSlice(model, (m) => {
    const activeTodos = m.todos.filter(t => !t.completed);
    const completedTodos = m.todos.filter(t => t.completed);
    
    return {
      total: m.todos.length,
      active: activeTodos.length,
      completed: completedTodos.length,
      hasCompleted: completedTodos.length > 0,
      allCompleted: m.todos.length > 0 && activeTodos.length === 0
    };
  });

  // Filtered todos computation
  const filteredTodos = () => todoState((state) => {
    let filtered = state.todos;
    
    // Apply filter
    if (state.filter === 'active') {
      filtered = filtered.filter(t => !t.completed);
    } else if (state.filter === 'completed') {
      filtered = filtered.filter(t => t.completed);
    }
    
    // Apply search
    if (state.searchQuery) {
      filtered = filtered.filter(t => 
        t.text.toLowerCase().includes(state.searchQuery.toLowerCase())
      );
    }
    
    return {
      items: filtered,
      count: filtered.length,
      isEmpty: filtered.length === 0
    };
  });

  // Composite button slice using select
  const filterButton = (filterType: 'all' | 'active' | 'completed') => 
    createSlice(model, (m) => ({
      onClick: select(actions, (a) => () => a.setFilter(filterType)),
      isActive: m.filter === filterType,
      label: filterType.charAt(0).toUpperCase() + filterType.slice(1),
      'aria-pressed': m.filter === filterType
    }));

  return {
    model,
    actions,
    views: {
      stats: statsSlice,
      filteredTodos,
      allButton: filterButton('all'),
      activeButton: filterButton('active'),
      completedButton: filterButton('completed')
    }
  };
});

// Create the store
const store = createZustandAdapter(todoApp);

// Type inference tests
function typeTests() {
  console.log('=== Type Inference Tests ===\n');

  // Test 1: Actions are properly typed
  console.log('1. Actions types:');
  console.log('  - addTodo:', typeof store.actions.addTodo);
  console.log('  - toggleTodo:', typeof store.actions.toggleTodo);
  console.log('  - Type check passes:', 'addTodo' in store.actions);

  // Test 2: Views are properly typed
  console.log('\n2. View types:');
  console.log('  - stats:', typeof store.views.stats);
  console.log('  - filteredTodos:', typeof store.views.filteredTodos);
  console.log('  - allButton:', typeof store.views.allButton);

  // Test 3: Execute views and check results
  console.log('\n3. View execution:');
  const stats = store.views.stats();
  console.log('  - Stats result:', stats);
  console.log('  - Stats has expected properties:', 
    'total' in stats && 'active' in stats && 'completed' in stats
  );

  const filtered = store.views.filteredTodos();
  console.log('  - Filtered todos:', filtered);
  console.log('  - Filtered has expected properties:', 
    'items' in filtered && 'count' in filtered && 'isEmpty' in filtered
  );

  const button = store.views.allButton();
  console.log('  - Button attributes:', button);
  console.log('  - Button has onClick:', typeof button.onClick);

  // Test 4: Actions work correctly
  console.log('\n4. Action execution:');
  store.actions.addTodo('Test todo 1');
  console.log('  - After adding todo:', store.views.stats());
  
  store.actions.addTodo('Test todo 2');
  console.log('  - After adding second todo:', store.views.stats());
  
  // Get the first todo ID
  const todos = store.views.filteredTodos().items;
  if (todos.length > 0) {
    store.actions.toggleTodo(todos[0].id);
    console.log('  - After toggling first todo:', store.views.stats());
  }

  // Test 5: Filter functionality
  console.log('\n5. Filter functionality:');
  store.actions.setFilter('active');
  console.log('  - Active filter:', store.views.filteredTodos());
  
  store.actions.setFilter('completed');
  console.log('  - Completed filter:', store.views.filteredTodos());

  // Test 6: Button interactivity
  console.log('\n6. Button functionality:');
  const activeBtn = store.views.activeButton();
  console.log('  - Active button pressed:', activeBtn['aria-pressed']);
  
  // Click all button
  const allBtn = store.views.allButton();
  if (allBtn.onClick) {
    allBtn.onClick();
    console.log('  - After clicking all button:', store.views.allButton()['aria-pressed']);
  }

  // Test 7: Subscription
  console.log('\n7. Subscription test:');
  let updateCount = 0;
  const unsubscribe = store.subscribe(
    views => views.stats(),
    stats => {
      updateCount++;
      console.log('  - Stats updated:', stats);
    }
  );

  store.actions.addTodo('Subscription test');
  console.log('  - Update count after action:', updateCount);
  
  unsubscribe();
  store.actions.addTodo('Should not trigger');
  console.log('  - Update count after unsubscribe:', updateCount);

  console.log('\n=== All tests completed ===');
}

// Export for TypeScript to check types
export { store, todoApp, typeTests };