// This is a demo app that uses the instrumented Lattice DevTools
// In a real app, you would import from '@lattice/devtools'
// For this demo, we'll create a simple implementation that mimics the devtools

// First, let's simulate having Lattice devtools available
window.__LATTICE_DEVTOOLS__ = {
  enabled: true,
  options: { name: 'Demo App' }
};

// Simulate the bridge that the content script creates
window.__LATTICE_DEVTOOLS_BRIDGE__ = {
  send: (event) => {
    // Send to extension via postMessage
    window.postMessage({
      source: 'lattice-devtools',
      type: 'EVENT',
      payload: event
    }, '*');
  }
};

// Simple reactive system for demo
class Signal {
  constructor(value, onChange) {
    this._value = value;
    this._onChange = onChange;
  }
  
  get value() {
    return this._value;
  }
  
  set value(newValue) {
    const oldValue = this._value;
    this._value = newValue;
    if (this._onChange) {
      this._onChange(newValue, oldValue);
    }
  }
}

// Create some demo reactive state
const state = {
  count: new Signal(0, (newVal, oldVal) => {
    // Update UI
    document.getElementById('count').textContent = newVal;
    
    // Send event to devtools
    window.__LATTICE_DEVTOOLS_BRIDGE__.send({
      type: 'SIGNAL_WRITE',
      timestamp: Date.now(),
      contextId: 'demo-context',
      data: {
        id: 'count-signal',
        name: 'count',
        oldValue: oldVal,
        newValue: newVal
      }
    });
  }),
  
  todos: new Signal([], (newVal) => {
    // Update UI
    const todoList = document.getElementById('todoList');
    todoList.innerHTML = newVal.map((todo, i) => 
      `<div>${i + 1}. ${todo}</div>`
    ).join('');
    
    // Send event to devtools
    window.__LATTICE_DEVTOOLS_BRIDGE__.send({
      type: 'SIGNAL_WRITE',
      timestamp: Date.now(),
      contextId: 'demo-context',
      data: {
        id: 'todos-signal',
        name: 'todos',
        newValue: newVal
      }
    });
  })
};

// Computed value
const updateDoubled = () => {
  const doubled = state.count.value * 2;
  document.getElementById('doubled').textContent = doubled;
  
  window.__LATTICE_DEVTOOLS_BRIDGE__.send({
    type: 'COMPUTED_END',
    timestamp: Date.now(),
    contextId: 'demo-context',
    data: {
      id: 'doubled-computed',
      name: 'doubled',
      value: doubled
    }
  });
};

// Initialize devtools metadata
window.__LATTICE_DEVTOOLS_BRIDGE__.send({
  type: 'CONTEXT_CREATED',
  timestamp: Date.now(),
  contextId: 'demo-context',
  data: { name: 'Demo Context' }
});

window.__LATTICE_DEVTOOLS_BRIDGE__.send({
  type: 'SIGNAL_CREATED',
  timestamp: Date.now(),
  contextId: 'demo-context',
  data: {
    id: 'count-signal',
    name: 'count',
    initialValue: 0
  }
});

window.__LATTICE_DEVTOOLS_BRIDGE__.send({
  type: 'SIGNAL_CREATED',
  timestamp: Date.now(),
  contextId: 'demo-context',
  data: {
    id: 'todos-signal',
    name: 'todos',
    initialValue: []
  }
});

window.__LATTICE_DEVTOOLS_BRIDGE__.send({
  type: 'COMPUTED_CREATED',
  timestamp: Date.now(),
  contextId: 'demo-context',
  data: {
    id: 'doubled-computed',
    name: 'doubled'
  }
});

// Event handlers
document.getElementById('increment').addEventListener('click', () => {
  state.count.value++;
  updateDoubled();
});

document.getElementById('decrement').addEventListener('click', () => {
  state.count.value--;
  updateDoubled();
});

document.getElementById('reset').addEventListener('click', () => {
  state.count.value = 0;
  updateDoubled();
});

document.getElementById('addTodo').addEventListener('click', () => {
  const input = document.getElementById('todoInput');
  if (input.value.trim()) {
    state.todos.value = [...state.todos.value, input.value.trim()];
    input.value = '';
  }
});

document.getElementById('todoInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addTodo').click();
  }
});

// Initial render
updateDoubled();

console.log('Lattice DevTools Demo loaded! Open DevTools to see the Lattice panel.');