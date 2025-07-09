import { enableDevTools, createStore } from '@lattice/devtools';

// Enable DevTools first
enableDevTools({
  name: 'Lattice Demo App',
  enableProfiling: true,
});

// Create a store for counter
const counterStore = createStore({
  count: 0,
}, 'CounterStore');

// Create computed value for doubled
const doubledComputed = counterStore.getContext().computed(() => {
  return counterStore.state.count.value * 2;
}, 'doubled');

// Create a store for todos
const todoStore = createStore({
  todos: [],
  filter: 'all', // all, active, completed
}, 'TodoStore');

// Update UI when count changes
counterStore.getContext().effect(() => {
  document.getElementById('count').textContent = counterStore.state.count.value;
}, 'updateCountDisplay');

// Update UI when doubled changes
counterStore.getContext().effect(() => {
  document.getElementById('doubled').textContent = doubledComputed.value;
}, 'updateDoubledDisplay');

// Update UI when todos change
todoStore.getContext().effect(() => {
  const todoList = document.getElementById('todoList');
  const todos = todoStore.state.todos.value;
  
  if (todos.length === 0) {
    todoList.innerHTML = '<div style="color: #666;">No todos yet...</div>';
  } else {
    todoList.innerHTML = todos.map((todo, i) => 
      `<div>${i + 1}. ${todo.text} ${todo.completed ? '✓' : ''}</div>`
    ).join('');
  }
}, 'updateTodoDisplay');

// Event handlers
document.getElementById('increment').addEventListener('click', () => {
  counterStore.set({ count: counterStore.state.count.value + 1 });
});

document.getElementById('decrement').addEventListener('click', () => {
  counterStore.set({ count: counterStore.state.count.value - 1 });
});

document.getElementById('reset').addEventListener('click', () => {
  counterStore.set({ count: 0 });
});

document.getElementById('addTodo').addEventListener('click', () => {
  const input = document.getElementById('todoInput');
  if (input.value.trim()) {
    const newTodo = {
      id: Date.now(),
      text: input.value.trim(),
      completed: false,
    };
    
    todoStore.set({
      todos: [...todoStore.state.todos.value, newTodo]
    });
    
    input.value = '';
  }
});

document.getElementById('todoInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addTodo').click();
  }
});

// Log to console
console.log('Lattice DevTools Demo loaded!');
console.log('Open Chrome DevTools and look for the "Lattice" tab.');
console.log('You should see:');
console.log('- Two contexts: CounterStore and TodoStore');
console.log('- Signals for count and todos');
console.log('- Computed value for doubled');
console.log('- Effects for updating the UI');