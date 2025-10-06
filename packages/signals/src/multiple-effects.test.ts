/**
 * Test case to reproduce bug where some effects don't run when signal changes
 *
 * Bug scenario from devtools example:
 * - Signal `todos` is updated
 * - Effect 1 (reads completedCount computed + todos) runs ✓
 * - Effect 2 (reads count + todos.length) doesn't run ✗
 * - Effect 3 (reads count + doubled + isEven + todos) doesn't run ✗
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, effect, resetGlobalState } from './test-setup';

describe('multiple effects on signal change', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should run all effects when signal changes', () => {

    // State setup similar to devtools example
    const count = signal(0);
    const todos = signal([
      { id: 1, text: 'Learn Lattice', completed: false },
      { id: 2, text: 'Build an app', completed: false }
    ]);

    const doubled = computed(() => count() * 2);
    const isEven = computed(() => count() % 2 === 0);
    const completedCount = computed(() =>
      todos().filter(todo => todo.completed).length
    );

    // Track which effects run
    const runs: string[] = [];

    // Effect 1: Reads completedCount (computed) + todos
    // This creates dependencies: effect1 -> completedCount, effect1 -> todos
    effect(() => {
      const completed = completedCount();
      const total = todos().length;
      runs.push(`effect1: ${completed}/${total}`);
    });

    // Effect 2: Reads count + todos.length
    // This creates dependencies: effect2 -> count, effect2 -> todos
    effect(() => {
      const c = count();
      const t = todos().length;
      runs.push(`effect2: count=${c}, todos=${t}`);
    });

    // Effect 3: Reads count + doubled + isEven + todos (like updateUI)
    // This creates dependencies: effect3 -> count, effect3 -> doubled, effect3 -> isEven, effect3 -> todos
    effect(() => {
      const c = count();
      const d = doubled();
      const e = isEven();
      const t = todos();
      runs.push(`effect3: count=${c}, doubled=${d}, isEven=${e}, todos=${t.length}`);
    });

    // So todos.subscribers should be: completedCount -> effect1 -> effect2 -> effect3

    // Clear initial runs
    runs.length = 0;

    // Update todos (like addTodo)
    todos([...todos(), { id: 3, text: 'New todo', completed: false }]);

    expect(runs).toContain('effect1: 0/3');
    expect(runs).toContain('effect2: count=0, todos=3');
    expect(runs).toContain('effect3: count=0, doubled=0, isEven=true, todos=3');

    // Verify all 3 effects ran
    expect(runs.length).toBe(3);
  });

  it('should run all effects when count changes after todos was updated', () => {

    const count = signal(0);
    const todos = signal([
      { id: 1, text: 'Learn Lattice', completed: false },
      { id: 2, text: 'Build an app', completed: false }
    ]);

    computed(() => count() * 2);
    computed(() => todos().filter(todo => todo.completed).length);

    const runs: string[] = [];

    effect(() => {
      runs.push(`effect1: todos=${todos().length}`);
    });

    effect(() => {
      const c = count();
      const t = todos();
      runs.push(`effect2: count=${c}, todos=${t.length}`);
    });

    runs.length = 0;

    // First update todos
    todos([...todos(), { id: 3, text: 'New todo', completed: false }]);

    const runsAfterTodos = [...runs];
    runs.length = 0;

    // Then update count
    count(1);

    console.log('Runs after todos:', runsAfterTodos);
    console.log('Runs after count:', runs);

    // After count changes, effect2 should see the updated todos length (3)
    expect(runs).toContain('effect2: count=1, todos=3');
  });
});
