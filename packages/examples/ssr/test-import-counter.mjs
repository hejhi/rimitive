console.log('A. Starting import...');
const { Counter } = await import('./src/islands/Counter.js');
console.log('B. Import complete, Counter type:', typeof Counter);
console.log('C. Calling Counter with props...');
const spec = Counter({ initialCount: 5 });
console.log('D. Got spec, status:', spec.status);
console.log('E. SUCCESS - no hang on import or call');
