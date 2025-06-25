/**
 * @fileoverview Show what "respecting dependencies" means vs not respecting them
 */

import { describe, it } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

describe('What Does "Respecting Dependencies" Mean?', () => {
  it('should show the difference', () => {
    console.log('\n=== LATTICE: RESPECTS DEPENDENCIES ===\n');
    
    const createSlice = createLatticeStore(vanillaAdapter({ 
      a: 1,
      b: 2,
      c: 3
    }));

    // This slice only selects 'a' and 'b'
    const abSlice = createSlice(select('a', 'b'), ({ a, b }, set) => ({
      // This function will ALWAYS be called when accessed
      multiply: () => {
        console.log(`Computing a * b: ${a()} * ${b()} = ${a() * b()}`);
        return a() * b();
      },
      setA: (n: number) => set(() => ({ a: n })),
      setB: (n: number) => set(() => ({ b: n }))
    }));

    const cSlice = createSlice(select('c'), ({ c }, set) => ({
      value: () => c(),
      setC: (n: number) => set(() => ({ c: n }))
    }));

    console.log('Initial computation:');
    abSlice().multiply(); // Computes: 1 * 2 = 2

    console.log('\nUpdate c to 999:');
    cSlice().setC(999);
    console.log('Access multiply again:');
    abSlice().multiply(); // Still computes: 1 * 2 = 2 (c change doesn't affect this)

    console.log('\nUpdate a to 10:');
    abSlice().setA(10);
    console.log('Access multiply again:');
    abSlice().multiply(); // Now computes: 10 * 2 = 20

    console.log('\n=== HYPOTHETICAL SYSTEM THAT DOESN\'T RESPECT DEPENDENCIES ===\n');
    console.log('Imagine if Lattice worked like this:');
    console.log('- abSlice selects only "a" and "b"');
    console.log('- But updating "c" would somehow cause abSlice to see different values');
    console.log('- Or updating "c" would prevent abSlice from working');
    console.log('This would be "not respecting dependencies"!');

    console.log('\n=== WHAT "RESPECTING DEPENDENCIES" MEANS ===\n');
    console.log('1. ISOLATION: Each slice can ONLY see the data it selected');
    console.log('   - abSlice cannot access c, even if it wanted to');
    console.log('   - cSlice cannot access a or b');
    console.log('');
    console.log('2. BOUNDARIES: Updates to unselected data don\'t affect the slice');
    console.log('   - Updating c doesn\'t change what abSlice sees');
    console.log('   - abSlice always sees the current values of a and b');
    console.log('');
    console.log('3. CONSISTENCY: The slice always works with its selected data');
    console.log('   - multiply() ALWAYS computes when called (eager evaluation)');
    console.log('   - But it ONLY uses a and b values (respects dependencies)');
    
    console.log('\n=== THE KEY DIFFERENCE FROM SVELTE ===\n');
    console.log('SVELTE: "I\'ll only recompute when a or b changes"');
    console.log('  - Tracks which dependencies changed');
    console.log('  - Skips computation if dependencies haven\'t changed');
    console.log('');
    console.log('LATTICE: "I\'ll always compute when asked, but only using a and b"');
    console.log('  - Always runs the computation (no caching)');
    console.log('  - But strictly limited to selected dependencies');
    console.log('  - Changes to c are invisible to abSlice');
  });
});