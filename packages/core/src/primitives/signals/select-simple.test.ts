import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalFactory } from './lattice-integration';
import { resetGlobalState } from './test-setup';

describe('select - actual behavior', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('demonstrates that select tracks reference equality', () => {
    const factory = createSignalFactory();
    const state = factory.signal({
      users: [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ],
      selectedId: 1
    });

    let johnSelectCount = 0;
    
    // This will fire whenever state.value changes AT ALL
    // because state.value.users[0] returns a new reference each time
    const john = state.select(s => s.users[0]);
    john.subscribe(() => johnSelectCount++);
    
    // Change selectedId - john subscription WILL fire
    // because the computed re-runs and returns users[0] again
    state.set('selectedId', 2);
    expect(johnSelectCount).toBe(1); // Fires even though John didn't change!
  });

  it('shows how to achieve fine-grained updates', () => {
    const factory = createSignalFactory();
    
    // Solution 1: Signal per item
    const users = [
      factory.signal({ id: 1, name: 'John' }),
      factory.signal({ id: 2, name: 'Jane' })
    ];
    
    let johnCount = 0;
    users[0].subscribe(() => johnCount++);
    
    // Update Jane - John doesn't fire
    users[1].value = { id: 2, name: 'Janet' };
    expect(johnCount).toBe(0);
    
    // Update John - fires
    users[0].value = { id: 1, name: 'Johnny' };
    expect(johnCount).toBe(1);
  });

  it('shows select working correctly with primitive values', () => {
    const factory = createSignalFactory();
    const state = factory.signal({
      user: { name: 'John', age: 30 },
      theme: 'dark'
    });

    let nameCount = 0;
    let ageCount = 0;
    
    // Select primitive values (strings, numbers)
    const name = state.select(s => s.user.name);
    const age = state.select(s => s.user.age);
    
    name.subscribe(() => nameCount++);
    age.subscribe(() => ageCount++);
    
    // Update only name - only name fires
    state.set('user', { name: 'Jane', age: 30 });
    expect(nameCount).toBe(1);
    expect(ageCount).toBe(0); // Age didn't change (30 === 30)
    
    // Update only age - only age fires
    state.set('user', { name: 'Jane', age: 31 });
    expect(nameCount).toBe(1); // Name didn't change ('Jane' === 'Jane')
    expect(ageCount).toBe(1);
  });

  it('shows why array element selection is tricky', () => {
    const factory = createSignalFactory();
    const todos = factory.signal([
      { id: 1, text: 'Task 1', done: false },
      { id: 2, text: 'Task 2', done: false }
    ]);

    // Track the actual object reference
    let todo1Ref = todos.value[0];
    let refChangeCount = 0;
    
    const firstTodo = todos.select(t => t[0]);
    firstTodo.subscribe(() => {
      if (todos.value[0] !== todo1Ref) {
        refChangeCount++;
        todo1Ref = todos.value[0];
      }
    });
    
    // Update second todo - creates new array, but todos[0] is SAME reference
    const newArray = [...todos.value];
    newArray[1] = { ...newArray[1], done: true };
    todos.value = newArray;
    
    expect(refChangeCount).toBe(0); // Reference didn't change!
    
    // Update first todo - creates new object reference
    todos.set(0, { ...todos.value[0], done: true });
    expect(refChangeCount).toBe(1); // Reference DID change
  });
});