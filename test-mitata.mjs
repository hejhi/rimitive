import { bench, run } from 'mitata';

let generatorCalls = 0;
let yieldCalls = 0;
let nodeCreated = false;

bench('test', function* () {
  generatorCalls++;
  console.log(`Generator call ${generatorCalls}`);

  // Create node outside yield
  if (!nodeCreated) {
    console.log('Creating node outside yield');
    nodeCreated = true;
  }

  yield () => {
    yieldCalls++;
    // This is what gets benchmarked
  };
});

await run({
  min_samples: 5,
  max_samples: 10
});

console.log(`\nResults:`);
console.log(`Generator calls: ${generatorCalls}`);
console.log(`Yield calls: ${yieldCalls}`);
console.log(`Node created: ${nodeCreated ? 'once' : 'never'}`);