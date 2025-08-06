import { describe, it } from 'vitest';
import { 
  createSignalAPI,
  createSignalFactory,
  createComputedFactory,
  createEffectFactory
} from '../index';

describe('Early Termination Optimization Concept', () => {
  it('shows how early termination could work', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory
    });

    console.log('\n=== EARLY TERMINATION CONCEPT ===\n');

    // Track what happens during updates
    const events: string[] = [];

    // Source signal
    const source = signal(10);

    // Simulated optimized filter with early termination
    const createOptimizedFilter = (name: string) => {
      let lastInputs: any[] = [];
      let lastOutput: any = undefined;
      let computations = 0;
      
      return computed(() => {
        const value = source.value;
        
        // OPTIMIZATION: Check if inputs that affect output have changed
        if (lastInputs.length > 0 && value < 50 && lastInputs[0] < 50) {
          events.push(`${name}: Early termination - both values filtered, returning cached null`);
          return lastOutput; // Return cached value without recomputing
        }
        
        // Otherwise, do the computation
        computations++;
        events.push(`${name}: Computing (computation #${computations})`);
        lastInputs = [value];
        lastOutput = value < 50 ? null : value;
        return lastOutput;
      });
    };

    // Current implementation (always recomputes)
    const standardFilter = (() => {
      let computations = 0;
      return computed(() => {
        computations++;
        events.push(`standardFilter: Computing (computation #${computations})`);
        const value = source.value;
        return value < 50 ? null : value;
      });
    })();

    const optimizedFilter = createOptimizedFilter('optimizedFilter');

    // Initial read
    events.push('--- Initial read (source=10) ---');
    standardFilter.value;
    optimizedFilter.value;

    // Change source but keep filtered
    events.push('\n--- Change source to 20 (still filtered) ---');
    source.value = 20;
    standardFilter.value;
    optimizedFilter.value;

    // Change source but keep filtered again
    events.push('\n--- Change source to 30 (still filtered) ---');
    source.value = 30;
    standardFilter.value;
    optimizedFilter.value;

    // Change to non-filtered
    events.push('\n--- Change source to 60 (not filtered) ---');
    source.value = 60;
    standardFilter.value;
    optimizedFilter.value;

    // Back to filtered
    events.push('\n--- Change source to 40 (filtered again) ---');
    source.value = 40;
    standardFilter.value;
    optimizedFilter.value;

    // Print events
    events.forEach(e => console.log(e));

    console.log('\n=== SUMMARY ===');
    console.log('Standard filter computed 5 times (every change)');
    console.log('Optimized filter computed 3 times (skipped when output unchanged)');
    console.log('This represents a 40% reduction in computations!');
  });

  it('demonstrates the key insight for optimization', () => {
    console.log('\n=== KEY INSIGHT FOR OPTIMIZATION ===\n');
    console.log('Current behavior:');
    console.log('1. Source changes (10 -> 20)');
    console.log('2. Filter is marked dirty');
    console.log('3. Filter recomputes: reads source, returns null');
    console.log('4. Version unchanged (null -> null)');
    console.log('5. Dependents correctly skip recomputation\n');
    
    console.log('Optimized behavior:');
    console.log('1. Source changes (10 -> 20)');
    console.log('2. Filter is marked dirty');
    console.log('3. Filter checks: "Can my output change?"');
    console.log('   - Previous: source < 50, output = null');
    console.log('   - Current: source still < 50, output = null');
    console.log('4. Skip recomputation, keep version unchanged');
    console.log('5. Dependents correctly skip recomputation\n');
    
    console.log('The optimization requires:');
    console.log('- Tracking which inputs affect the output');
    console.log('- Quick check before full recomputation');
    console.log('- Return cached value if output unchanged');
  });
});