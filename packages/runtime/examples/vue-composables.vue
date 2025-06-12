<template>
  <div class="counter-example">
    <h2>Vue Composables Example</h2>
    
    <!-- Using useSliceSelector -->
    <section>
      <h3>useSliceSelector</h3>
      <p>Count: {{ data.count }} ({{ data.isEven ? 'even' : 'odd' }})</p>
    </section>
    
    <!-- Using useSliceValues with destructuring -->
    <section>
      <h3>useSliceValues</h3>
      <p>User: {{ name }} ({{ email }})</p>
      <p>Items in cart: {{ itemCount }}</p>
    </section>
    
    <!-- Using useSlice directly -->
    <section>
      <h3>useSlice</h3>
      <button @click="counter.increment">
        Increment (current: {{ counter.value() }})
      </button>
    </section>
    
    <!-- Using useLattice for values + actions -->
    <section>
      <h3>useLattice</h3>
      <p>Todo: {{ values.todo?.text || 'No todo selected' }}</p>
      <button @click="() => slices.todos.toggle(todoId)">
        Toggle Complete
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { 
  useSliceSelector, 
  useSliceValues, 
  useSlice, 
  useLattice 
} from '@lattice/runtime/vue';

// Assume we have a store instance passed as prop or injected
const props = defineProps<{
  store: any; // Your actual store type
  todoId: string;
}>();

// Example 1: Select specific values with custom equality
const data = useSliceSelector(props.store, (slices) => ({
  count: slices.counter.value(),
  isEven: slices.counter.isEven()
}));

// Example 2: Select multiple values with destructuring support
const { name, email, itemCount } = useSliceValues(props.store, (slices) => ({
  name: slices.user.name(),
  email: slices.user.email(),
  itemCount: slices.cart.itemCount()
}));

// Example 3: Access a single slice directly
const counter = useSlice(props.store, 'counter');

// Example 4: Get both reactive values and action methods
const { values, slices } = useLattice(props.store, (s) => ({
  todo: s.todos.getById(props.todoId),
  isCompleted: s.todos.isCompleted(props.todoId)
}));

// Custom equality function example
const { values: thresholdValues } = useLattice(
  props.store,
  (s) => s.metrics.threshold(),
  // Only update when difference is significant
  (a, b) => Math.abs(a - b) < 10
);
</script>

<style scoped>
.counter-example {
  padding: 20px;
  font-family: sans-serif;
}

section {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

h3 {
  margin-top: 0;
  color: #333;
}

button {
  padding: 8px 16px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #3aa876;
}
</style>