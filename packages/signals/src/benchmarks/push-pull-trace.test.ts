import { describe, it, expect } from 'vitest';
import { 
  createSignalAPI,
  createSignalFactory,
  createComputedFactory,
  createEffectFactory
} from '../index';

describe('Push-Pull Trace Analysis', () => {
  it('traces diamond pattern execution flow', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory
    });
    const logs: string[] = [];

    // Create source signal
    const source = signal(10);

    // Create filtered computeds with detailed logging
    const filterA = computed(() => {
      const value = source.value;
      logs.push(`filterA: reading source, value=${value}`);
      
      if (value < 50) {
        logs.push(`filterA: filtered out (value < 50)`);
        return null;
      }
      
      logs.push(`filterA: passing through value=${value}`);
      return value;
    });

    const filterB = computed(() => {
      const value = source.value;
      logs.push(`filterB: reading source, value=${value}`);
      
      if (value < 50) {
        logs.push(`filterB: filtered out (value < 50)`);
        return null;
      }
      
      logs.push(`filterB: passing through value=${value}`);
      return value;
    });

    // Create expensive computation with logging
    const expensive = computed(() => {
      logs.push(`expensive: starting computation`);
      
      const a = filterA.value;
      logs.push(`expensive: read filterA, value=${a}`);
      
      const b = filterB.value;
      logs.push(`expensive: read filterB, value=${b}`);
      
      if (a === null || b === null) {
        logs.push(`expensive: returning 0 (filtered)`);
        return 0;
      }
      
      const result = a + b;
      logs.push(`expensive: computed result=${result}`);
      return result;
    });

    // Patch the computed nodes to add more detailed logging
    const patchComputed = (computed: any, name: string) => {
      const original_refresh = computed._refresh?.bind(computed);
      const original_recompute = computed._recompute?.bind(computed);
      const original_update = computed._update?.bind(computed);

      if (original_refresh) {
        computed._refresh = () => {
          logs.push(`${name}: _refresh() called, flags before: ${computed._flags}`);
          const result = original_refresh();
          logs.push(`${name}: _refresh() done, flags after: ${computed._flags}, result: ${result}`);
          return result;
        };
      }

      if (original_recompute) {
        computed._recompute = () => {
          logs.push(`${name}: _recompute() called, version before: ${computed._version}`);
          const result = original_recompute();
          logs.push(`${name}: _recompute() done, version after: ${computed._version}`);
          return result;
        };
      }

      if (original_update) {
        computed._update = () => {
          logs.push(`${name}: _update() called`);
          const result = original_update();
          logs.push(`${name}: _update() done`);
          return result;
        };
      }
    };

    patchComputed(filterA, 'filterA');
    patchComputed(filterB, 'filterB');
    patchComputed(expensive, 'expensive');

    // Test scenario
    logs.push('=== Initial read (source=10) ===');
    const result1 = expensive.value;
    logs.push(`Result: ${result1}`);
    
    logs.push('\n=== Change source to 20 (still filtered) ===');
    source.value = 20;
    
    logs.push('\n=== Second read (source=20) ===');
    const result2 = expensive.value;
    logs.push(`Result: ${result2}`);
    
    logs.push('\n=== Change source to 60 (not filtered) ===');
    source.value = 60;
    
    logs.push('\n=== Third read (source=60) ===');
    const result3 = expensive.value;
    logs.push(`Result: ${result3}`);

    // Print all logs
    console.log('\n--- EXECUTION TRACE ---');
    logs.forEach(log => console.log(log));
    console.log('--- END TRACE ---\n');

    // Verify results
    expect(result1).toBe(0);
    expect(result2).toBe(0);
    expect(result3).toBe(120);
  });

  it('compares flag propagation behavior', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory
    });
    const logs: string[] = [];

    // Helper to get flag names
    const getFlagNames = (flags: number): string[] => {
      const names: string[] = [];
      if (flags & 1) names.push('Dirty');
      if (flags & 2) names.push('ToCheck');
      if (flags & 4) names.push('Tracking');
      return names;
    };

    // Create source signal
    const source = signal(10);

    // Create a computed that tracks flag changes
    const tracked = computed(() => {
      const value = source.value;
      return value < 50 ? null : value;
    });

    // Patch to log flag changes
    let lastFlags = tracked._flags;
    
    Object.defineProperty(tracked, '_flags', {
      get() { return lastFlags; },
      set(value) {
        if (value !== lastFlags) {
          logs.push(`Flag change: ${getFlagNames(lastFlags).join(',')} -> ${getFlagNames(value).join(',')}`);
        }
        lastFlags = value;
      }
    });

    // Run test
    logs.push('Initial read:');
    tracked.value;
    
    logs.push('\nAfter source change:');
    source.value = 20;
    
    logs.push('\nAfter second read:');
    tracked.value;

    // Print logs
    console.log('\n--- FLAG PROPAGATION ---');
    logs.forEach(log => console.log(log));
    console.log('--- END FLAGS ---\n');
  });

  it('counts recomputation calls', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory
    });
    const stats = {
      filterA: { refresh: 0, recompute: 0, checkDirty: 0 },
      filterB: { refresh: 0, recompute: 0, checkDirty: 0 },
      expensive: { refresh: 0, recompute: 0, checkDirty: 0 }
    };

    const source = signal(10);

    const filterA = computed(() => {
      const value = source.value;
      return value < 50 ? null : value;
    });

    const filterB = computed(() => {
      const value = source.value;
      return value < 50 ? null : value;
    });

    const expensive = computed(() => {
      const a = filterA.value;
      const b = filterB.value;
      return (a === null || b === null) ? 0 : a + b;
    });

    // Count calls
    const countCalls = (computed: any, name: keyof typeof stats) => {
      const original_refresh = computed._refresh?.bind(computed);
      const original_recompute = computed._recompute?.bind(computed);
      const original_update = computed._update?.bind(computed);

      if (original_refresh) {
        computed._refresh = () => {
          stats[name].refresh++;
          return original_refresh();
        };
      }

      if (original_recompute) {
        computed._recompute = () => {
          stats[name].recompute++;
          return original_recompute();
        };
      }

      if (original_update) {
        computed._update = () => {
          stats[name].checkDirty++;
          return original_update();
        };
      }
    };

    countCalls(filterA, 'filterA');
    countCalls(filterB, 'filterB');
    countCalls(expensive, 'expensive');

    // Run test
    console.log('\n--- RECOMPUTATION STATS ---');
    
    // Initial read
    expensive.value;
    console.log('After initial read:', JSON.stringify(stats, null, 2));
    
    // Reset stats
    Object.keys(stats).forEach(key => {
      stats[key as keyof typeof stats] = { refresh: 0, recompute: 0, checkDirty: 0 };
    });
    
    // Change source (still filtered)
    source.value = 20;
    expensive.value;
    console.log('\nAfter change to 20 (still filtered):', JSON.stringify(stats, null, 2));
    
    // Reset stats
    Object.keys(stats).forEach(key => {
      stats[key as keyof typeof stats] = { refresh: 0, recompute: 0, checkDirty: 0 };
    });
    
    // Change source (not filtered)
    source.value = 60;
    expensive.value;
    console.log('\nAfter change to 60 (not filtered):', JSON.stringify(stats, null, 2));
    
    console.log('--- END STATS ---\n');
  });
});