import { bench, run } from 'mitata';

let generatorCalls = 0;
let yieldFunctionCalls = 0;
const createdObjects: any[] = [];

bench('test', function* () {
  generatorCalls++;
  console.log(`Generator call ${generatorCalls}`);

  // Create objects outside yield - these accumulate!
  const obj = { id: generatorCalls, data: new Array(100).fill(0) };
  createdObjects.push(obj);
  console.log(`Created object ${obj.id}, total: ${createdObjects.length}`);

  yield () => {
    yieldFunctionCalls++;
    // This is what gets benchmarked - runs many times
  };
});

await run({
  min_samples: 5,
  max_samples: 10
});

console.log(`\nResults:`);
console.log(`Generator calls: ${generatorCalls}`);
console.log(`Yield function calls: ${yieldFunctionCalls}`);
console.log(`Objects created: ${createdObjects.length}`);
console.log(`Memory estimate: ${createdObjects.length * 100 * 8} bytes (roughly)`);