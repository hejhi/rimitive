import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalFactory } from './lattice-integration';
import { resetGlobalState } from './test-setup';

describe('select from computed', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should allow selecting from computed values', () => {
    const factory = createSignalFactory();
    const todos = factory.signal([
      { id: 1, text: 'Task 1', done: false, priority: 2 },
      { id: 2, text: 'Task 2', done: true, priority: 1 },
      { id: 3, text: 'Task 3', done: false, priority: 3 },
      { id: 4, text: 'Task 4', done: true, priority: 4 }
    ]);

    // Computed that filters completed todos
    const completedTodos = factory.computed(() => 
      todos.value.filter(t => t.done)
    );
    
    let firstCompletedCount = 0;
    
    // Select the first completed todo
    const firstCompleted = completedTodos.select(completed => completed[0]);
    firstCompleted.subscribe(() => firstCompletedCount++);
    
    // Initially: first completed is todo 2
    expect(firstCompleted.value).toEqual({ id: 2, text: 'Task 2', done: true, priority: 1 });
    
    // Mark todo 3 as done - doesn't change first completed
    todos.patch(2, { done: true });
    
    expect(firstCompletedCount).toBe(0); // No change - first is still todo 2
    expect(completedTodos.value).toHaveLength(3); // Now 3 completed
    
    // Mark todo 1 as done with priority 0 - changes first completed!
    todos.set(0, { ...todos.value[0], done: true, priority: 0 });
    
    expect(firstCompletedCount).toBe(1); // Changed!
    expect(firstCompleted.value).toEqual({ id: 1, text: 'Task 1', done: true, priority: 0 });
  });

  it('should work with sorted computed and top N selection', () => {
    const factory = createSignalFactory();
    const todos = factory.signal([
      { id: 1, text: 'Low priority', priority: 3 },
      { id: 2, text: 'High priority', priority: 1 },
      { id: 3, text: 'Medium priority', priority: 2 },
      { id: 4, text: 'Lowest priority', priority: 4 }
    ]);

    // Computed that sorts by priority
    const sortedTodos = factory.computed(() => 
      [...todos.value].sort((a, b) => a.priority - b.priority)
    );
    
    let topPriorityCount = 0;
    let top2Count = 0;
    
    // Select top priority and top 2
    const topPriority = sortedTodos.select(sorted => sorted[0]);
    const top2 = sortedTodos.select(sorted => sorted.slice(0, 2));
    
    topPriority.subscribe(() => topPriorityCount++);
    top2.subscribe(() => top2Count++);
    
    // Initially: top priority is todo 2
    expect(topPriority.value).toEqual({ id: 2, text: 'High priority', priority: 1 });
    expect(top2.value).toEqual([
      { id: 2, text: 'High priority', priority: 1 },
      { id: 3, text: 'Medium priority', priority: 2 }
    ]);
    
    // Change priority of todo 4 to 1.5 - doesn't affect top priority
    todos.patch(3, { priority: 1.5 });
    
    expect(topPriorityCount).toBe(0); // Top priority unchanged
    expect(top2Count).toBe(1); // Top 2 changed (now includes todo 4)
    expect(top2.value[1]).toEqual({ id: 4, text: 'Lowest priority', priority: 1.5 });
    
    // Give todo 1 highest priority
    todos.patch(0, { priority: 0 });
    
    expect(topPriorityCount).toBe(1); // Top priority changed!
    expect(topPriority.value).toEqual({ id: 1, text: 'Low priority', priority: 0 });
  });

  it('should handle complex filtering and selection', () => {
    const factory = createSignalFactory();
    const tasks = factory.signal([
      { id: 1, text: 'Review PR', done: false, assignee: 'John', due: '2024-01-15' },
      { id: 2, text: 'Fix bug', done: false, assignee: 'Jane', due: '2024-01-14' },
      { id: 3, text: 'Deploy', done: true, assignee: 'John', due: '2024-01-13' },
      { id: 4, text: 'Write tests', done: false, assignee: 'John', due: '2024-01-16' }
    ]);

    // Computed: John's incomplete tasks sorted by due date
    const johnsIncomplete = factory.computed(() => 
      tasks.value
        .filter(t => t.assignee === 'John' && !t.done)
        .sort((a, b) => a.due.localeCompare(b.due))
    );
    
    let nextTaskCount = 0;
    
    // Select John's next task
    const johnsNextTask = johnsIncomplete.select(tasks => tasks[0]);
    johnsNextTask.subscribe(() => nextTaskCount++);
    
    // Initially: Review PR (due Jan 15)
    expect(johnsNextTask.value?.text).toBe('Review PR');
    
    // Complete the Review PR task
    tasks.patch(0, { done: true });
    
    expect(nextTaskCount).toBe(1); // Next task changed
    expect(johnsNextTask.value?.text).toBe('Write tests'); // Now due Jan 16
    
    // Add urgent task for John
    const urgentTask = { 
      id: 5, 
      text: 'Hotfix', 
      done: false, 
      assignee: 'John', 
      due: '2024-01-10' 
    };
    factory.set(tasks, [...tasks.value, urgentTask]);
    
    expect(nextTaskCount).toBe(2); // Next task changed again
    expect(johnsNextTask.value?.text).toBe('Hotfix'); // Most urgent
  });

  it('demonstrates chained computed + select', () => {
    const factory = createSignalFactory();
    const users = factory.signal([
      { id: 1, name: 'Alice', score: 100, active: true },
      { id: 2, name: 'Bob', score: 85, active: false },
      { id: 3, name: 'Charlie', score: 95, active: true },
      { id: 4, name: 'David', score: 90, active: true }
    ]);

    // First computed: active users
    const activeUsers = factory.computed(() => 
      users.value.filter(u => u.active)
    );
    
    // Second computed: top scorers from active users
    const topScorers = factory.computed(() => 
      [...activeUsers.value].sort((a, b) => b.score - a.score).slice(0, 2)
    );
    
    let leaderCount = 0;
    
    // Select the leader
    const leader = topScorers.select(scorers => scorers[0]);
    leader.subscribe(() => leaderCount++);
    
    expect(leader.value?.name).toBe('Alice'); // Highest active scorer
    
    // Deactivate Alice
    users.patch(0, { active: false });
    
    expect(leaderCount).toBe(1); // Leader changed
    expect(leader.value?.name).toBe('Charlie'); // New leader
    
    // Bob becomes active with score 200
    users.set(1, { ...users.value[1], active: true, score: 200 });
    
    expect(leaderCount).toBe(2); // Leader changed again
    expect(leader.value?.name).toBe('Bob'); // Bob is now leader
  });
});