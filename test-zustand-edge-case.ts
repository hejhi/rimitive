/**
 * Test to verify if Zustand handles unsubscribe-during-notification correctly
 */

import { createStore } from 'zustand/vanilla';

console.log('Testing Zustand unsubscribe-during-notification behavior\n');

// Test 1: Basic unsubscribe during notification
console.log('Test 1: Unsubscribe during notification');
{
  const store = createStore(() => ({ count: 0 }));
  const results = [];
  let unsub2;

  const unsub1 = store.subscribe(() => {
    results.push('listener1');
    if (unsub2) unsub2(); // Unsubscribe listener 2
  });

  unsub2 = store.subscribe(() => {
    results.push('listener2');
  });

  const unsub3 = store.subscribe(() => {
    results.push('listener3');
  });

  // First update
  store.setState({ count: 1 });
  console.log('First update:', results);
  
  // Reset results
  results.length = 0;
  
  // Second update
  store.setState({ count: 2 });
  console.log('Second update:', results);
  
  // Cleanup
  unsub1();
  unsub3();
}

// Test 2: Subscribe during notification
console.log('\nTest 2: Subscribe during notification');
{
  const store = createStore(() => ({ count: 0 }));
  const results = [];
  let dynamicUnsub;

  const unsub1 = store.subscribe(() => {
    results.push('listener1');
    if (!dynamicUnsub) {
      dynamicUnsub = store.subscribe(() => {
        results.push('dynamic listener');
      });
    }
  });

  const unsub2 = store.subscribe(() => {
    results.push('listener2');
  });

  // First update
  store.setState({ count: 1 });
  console.log('First update:', results);
  
  // Reset results
  results.length = 0;
  
  // Second update
  store.setState({ count: 2 });
  console.log('Second update:', results);
  
  // Cleanup
  unsub1();
  unsub2();
  if (dynamicUnsub) dynamicUnsub();
}

// Test 3: Complex scenario with multiple unsubscribes
console.log('\nTest 3: Multiple unsubscribes during notification');
{
  const store = createStore(() => ({ count: 0 }));
  const results = [];
  const unsubscribers = [];

  // Create 5 listeners
  for (let i = 0; i < 5; i++) {
    const index = i;
    unsubscribers[i] = store.subscribe(() => {
      results.push(`listener${index}`);
      // Each listener unsubscribes the next one
      if (index < 4 && unsubscribers[index + 1]) {
        unsubscribers[index + 1]();
        unsubscribers[index + 1] = null;
      }
    });
  }

  // First update
  store.setState({ count: 1 });
  console.log('First update:', results);
  
  // Reset results
  results.length = 0;
  
  // Second update
  store.setState({ count: 2 });
  console.log('Second update:', results);
  
  // Cleanup
  unsubscribers.forEach(unsub => unsub && unsub());
}

// Test 4: Error in listener
console.log('\nTest 4: Error in listener (does it affect other listeners?)');
{
  const store = createStore(() => ({ count: 0 }));
  const results = [];

  store.subscribe(() => {
    results.push('listener1');
  });

  store.subscribe(() => {
    results.push('listener2-before-error');
    throw new Error('Test error');
  });

  store.subscribe(() => {
    results.push('listener3');
  });

  try {
    store.setState({ count: 1 });
  } catch (e) {
    console.log('Caught error:', e.message);
  }
  
  console.log('Results:', results);
}

console.log('\n✅ Tests complete');