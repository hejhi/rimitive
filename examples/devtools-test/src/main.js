// Import from @lattice/devtools to get instrumented versions
import { enableDevTools, createLattice, createStore } from '@lattice/devtools';

// Enable DevTools first
enableDevTools({
  name: 'Lattice Test App',
  enableProfiling: true,
});

// Counter Example
const counterContext = createLattice('Counter Context');
const counterStore = createStore({
  count: 0,
}, counterContext, 'Counter Store');

// Create named computed values
const doubled = counterContext.computed(() => counterStore.count.value * 2, 'doubled');
const squared = counterContext.computed(() => counterStore.count.value ** 2, 'squared');

// Create named effects
counterContext.effect(() => {
  document.getElementById('counter-value').textContent = counterStore.count.value;
  document.getElementById('doubled').textContent = doubled.value;
  document.getElementById('squared').textContent = squared.value;
}, 'counterDisplayEffect');

// Counter controls
document.getElementById('increment').addEventListener('click', () => {
  counterStore.count.value++;
});

document.getElementById('decrement').addEventListener('click', () => {
  counterStore.count.value--;
});

document.getElementById('reset').addEventListener('click', () => {
  counterStore.count.value = 0;
});

document.getElementById('add10').addEventListener('click', () => {
  // Demonstrate batching
  counterContext.batch(() => {
    for (let i = 0; i < 10; i++) {
      counterStore.count.value++;
    }
  });
});

// Todo List Example
const todoContext = createLattice('Todo Context');
const todoStore = createStore({
  todos: [],
  nextId: 1,
}, todoContext, 'Todo Store');

// Computed todo stats
const todoStats = todoContext.computed(() => {
  const todos = todoStore.todos.value;
  return {
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
  };
}, 'todoStats');

// Todo display effect
todoContext.effect(() => {
  const todos = todoStore.todos.value;
  const todoList = document.getElementById('todo-list');
  
  todoList.innerHTML = todos.map(todo => `
    <div class="todo-item ${todo.completed ? 'completed' : ''}">
      <span>${todo.text}</span>
      <div>
        <button onclick="toggleTodo(${todo.id})">${todo.completed ? 'Undo' : 'Complete'}</button>
        <button onclick="deleteTodo(${todo.id})">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Update stats
  const stats = todoStats.value;
  document.getElementById('todo-total').textContent = stats.total;
  document.getElementById('todo-active').textContent = stats.active;
  document.getElementById('todo-completed').textContent = stats.completed;
}, 'todoDisplayEffect');

// Make functions global for onclick handlers
window.toggleTodo = (id) => {
  const todos = todoStore.todos.value.map(todo =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  );
  todoStore.todos.value = todos;
};

window.deleteTodo = (id) => {
  todoStore.todos.value = todoStore.todos.value.filter(todo => todo.id !== id);
};

// Add todo handler
document.getElementById('add-todo').addEventListener('click', () => {
  const input = document.getElementById('todo-input');
  const text = input.value.trim();
  
  if (text) {
    todoStore.todos.value = [
      ...todoStore.todos.value,
      {
        id: todoStore.nextId.value,
        text,
        completed: false,
      }
    ];
    todoStore.nextId.value++;
    input.value = '';
  }
});

// Multiple Contexts Example
const contexts = [];
let contextCounter = 1;

document.getElementById('create-context').addEventListener('click', () => {
  // Create a new context with its own store
  const newContext = createLattice(`Dynamic Context ${contextCounter}`);
  const newStore = createStore({
    value: Math.floor(Math.random() * 100),
    name: `Context ${contextCounter}`,
  }, newContext);
  
  // Create a computed that depends on the value
  const computed = newContext.computed(() => newStore.value.value * 2, `computed${contextCounter}`);
  
  // Create an effect
  const effectDisposer = newContext.effect(() => {
    updateContextDisplay();
  }, `effect${contextCounter}`);
  
  contexts.push({
    id: contextCounter,
    context: newContext,
    store: newStore,
    computed,
    dispose: () => {
      effectDisposer();
      newContext.dispose();
    }
  });
  
  contextCounter++;
  updateContextDisplay();
});

function updateContextDisplay() {
  const contextsList = document.getElementById('contexts-list');
  contextsList.innerHTML = contexts.map(ctx => `
    <div style="margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 4px;">
      <strong>${ctx.store.name.value}</strong><br>
      Value: ${ctx.store.value.value} | Computed: ${ctx.computed.value}<br>
      <button onclick="updateContextValue(${ctx.id})">Random Value</button>
      <button onclick="disposeContext(${ctx.id})">Dispose</button>
    </div>
  `).join('');
}

window.updateContextValue = (id) => {
  const ctx = contexts.find(c => c.id === id);
  if (ctx) {
    ctx.store.value.value = Math.floor(Math.random() * 100);
  }
};

window.disposeContext = (id) => {
  const index = contexts.findIndex(c => c.id === id);
  if (index !== -1) {
    contexts[index].dispose();
    contexts.splice(index, 1);
    updateContextDisplay();
  }
};

// Add some initial todos
todoStore.todos.value = [
  { id: 1, text: 'Test Lattice DevTools', completed: false },
  { id: 2, text: 'Check the Timeline tab', completed: false },
  { id: 3, text: 'Inspect signals in the Inspector', completed: false },
];
todoStore.nextId.value = 4;

console.log('Lattice DevTools Test App loaded!');
console.log('Open Chrome DevTools and navigate to the "Lattice" tab.');