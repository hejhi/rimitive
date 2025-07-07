import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalFactory } from './lattice-integration';
import { resetGlobalState } from './test-setup';

describe('select from computed - reference behavior', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('shows how computed array operations affect select', () => {
    const factory = createSignalFactory();
    
    // Create todos with stable references
    const todo1 = { id: 1, text: 'Task 1', done: false };
    const todo2 = { id: 2, text: 'Task 2', done: true };
    const todo3 = { id: 3, text: 'Task 3', done: false };
    
    const todos = factory.signal([todo1, todo2, todo3]);

    // Computed that filters - creates NEW array each time
    const completedTodos = factory.computed(() => {
      console.log('Computing completed todos');
      return todos.value.filter(t => t.done);
    });
    
    let selectCount = 0;
    
    // Select first completed
    const firstCompleted = completedTodos.select(completed => {
      console.log('Select running, first item:', completed[0]);
      return completed[0];
    });
    
    firstCompleted.subscribe(() => {
      console.log('First completed changed!');
      selectCount++;
    });
    
    // Initial state
    expect(firstCompleted.value).toBe(todo2);
    
    // Update todo1 (not affecting completed todos)
    todos.value = [{ ...todo1, text: 'Updated' }, todo2, todo3];
    
    // Here's the KEY insight:
    // 1. todos changed, so completedTodos re-runs
    // 2. filter() creates a NEW array [todo2]
    // 3. But todo2 is the SAME object reference!
    // 4. So select sees completed[0] === todo2 (same reference)
    // 5. No notification!
    
    expect(selectCount).toBe(0); // Correct! todo2 reference unchanged
  });

  it('shows when select from computed DOES fire', () => {
    const factory = createSignalFactory();
    
    const todo1 = { id: 1, text: 'Task 1', done: false };
    const todo2 = { id: 2, text: 'Task 2', done: true };
    const todo3 = { id: 3, text: 'Task 3', done: false };
    
    const todos = factory.signal([todo1, todo2, todo3]);
    
    const completedTodos = factory.computed(() => 
      todos.value.filter(t => t.done)
    );
    
    let selectCount = 0;
    const firstCompleted = completedTodos.select(completed => completed[0]);
    firstCompleted.subscribe(() => selectCount++);
    
    // Make todo1 completed with HIGHER priority (will be first)
    const todo1Done = { ...todo1, done: true, priority: 1 };
    const todo2WithPriority = { ...todo2, priority: 2 };
    
    // Update with sorting so todo1Done comes first
    const sortedCompleted = factory.computed(() => 
      todos.value
        .filter(t => t.done)
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))
    );
    
    const firstSorted = sortedCompleted.select(sorted => sorted[0]);
    let sortedCount = 0;
    firstSorted.subscribe(() => sortedCount++);
    
    // Update todos
    todos.value = [todo1Done, todo2WithPriority, todo3];
    
    // firstSorted will fire because todo1Done is now first
    expect(sortedCount).toBe(1);
    expect(firstSorted.value).toBe(todo1Done);
  });

  it('shows the correct pattern for stable references', () => {
    const factory = createSignalFactory();
    
    // For stable references with computed + select, you need to:
    // 1. Preserve object references where possible
    // 2. Or select primitive values
    
    const users = factory.signal([
      { id: 1, name: 'Alice', score: 100 },
      { id: 2, name: 'Bob', score: 85 },
      { id: 3, name: 'Charlie', score: 95 }
    ]);
    
    // Select just the name (primitive) of top scorer
    const topScorer = factory.computed(() => 
      [...users.value].sort((a, b) => b.score - a.score)[0]
    );
    
    let nameChangeCount = 0;
    const topScorerName = topScorer.select(scorer => scorer?.name);
    topScorerName.subscribe(() => nameChangeCount++);
    
    expect(topScorerName.value).toBe('Alice');
    
    // Increase Bob's score to 110
    users.value = users.value.map(u => 
      u.id === 2 ? { ...u, score: 110 } : u
    );
    
    // Name changed from 'Alice' to 'Bob'
    expect(nameChangeCount).toBe(1);
    expect(topScorerName.value).toBe('Bob');
    
    // Update something else - name doesn't change
    users.value = users.value.map(u => 
      u.id === 3 ? { ...u, score: 50 } : u
    );
    
    expect(nameChangeCount).toBe(1); // Still Bob
  });
});