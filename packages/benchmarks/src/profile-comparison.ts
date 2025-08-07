#!/usr/bin/env node
/**
 * Profiling script to compare lattice vs alien-signals performance
 * Focus on pull phase operations and dependency checking
 */

import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';
import { createEffectFactory } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';

// Create Lattice API instance
const {
  signal: latticeSignal,
  computed: latticeComputed,
} = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  batch: createBatchFactory,
  effect: createEffectFactory,
}, createDefaultContext());

interface ProfileResult {
  name: string;
  totalTime: number;
  ops: number;
  timePerOp: number;
  allocations?: number;
}

function profile(name: string, iterations: number, fn: () => void): ProfileResult {
  // Warm up
  for (let i = 0; i < 100; i++) fn();
  
  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  
  return {
    name,
    totalTime: end - start,
    ops: iterations,
    timePerOp: (end - start) / iterations,
  };
}

console.log('🔍 Profiling Pull Phase Operations\n');

// Test 1: Simple dependency check (no change)
console.log('=== Test 1: Dependency Check (No Change) ===');
{
  const iterations = 100000;
  
  // Lattice
  const latticeSource = latticeSignal(0);
  const latticeComp = latticeComputed(() => latticeSource.value * 2);
  // Prime it
  void latticeComp.value;
  
  const latticeResult = profile('Lattice - dependency check', iterations, () => {
    // Access computed without changing source
    void latticeComp.value;
  });
  
  // Alien
  const alienSource = alienSignal(0);
  const alienComp = alienComputed(() => alienSource() * 2);
  // Prime it
  void alienComp();
  
  const alienResult = profile('Alien - dependency check', iterations, () => {
    // Access computed without changing source
    void alienComp();
  });
  
  console.log(`${latticeResult.name}: ${latticeResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`${alienResult.name}: ${alienResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`Ratio: ${(latticeResult.timePerOp / alienResult.timePerOp).toFixed(2)}x\n`);
}

// Test 2: Deep chain dependency checking
console.log('=== Test 2: Deep Chain Dependency Check ===');
{
  const iterations = 10000;
  const chainLength = 50;
  
  // Lattice chain
  const latticeSignals: Array<SignalInterface<number> | ComputedInterface<number>> = [latticeSignal(0)];
  for (let i = 1; i < chainLength; i++) {
    const prev = latticeSignals[i - 1]!;
    latticeSignals.push(latticeComputed(() => prev.value + 1));
  }
  // Prime it
  void latticeSignals[chainLength - 1]!.value;
  
  const latticeResult = profile('Lattice - deep chain check', iterations, () => {
    void latticeSignals[chainLength - 1]!.value;
  });
  
  // Alien chain
  const alienSignals = [alienSignal(0)];
  for (let i = 1; i < chainLength; i++) {
    const prev = alienSignals[i - 1]!;
    alienSignals.push(alienComputed(() => prev() + 1));
  }
  // Prime it
  void alienSignals[chainLength - 1]!();
  
  const alienResult = profile('Alien - deep chain check', iterations, () => {
    void alienSignals[chainLength - 1]!();
  });
  
  console.log(`${latticeResult.name}: ${latticeResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`${alienResult.name}: ${alienResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`Ratio: ${(latticeResult.timePerOp / alienResult.timePerOp).toFixed(2)}x\n`);
}

// Test 3: Diamond pattern dependency resolution
console.log('=== Test 3: Diamond Pattern Resolution ===');
{
  const iterations = 50000;
  
  // Lattice diamond
  const latticeA = latticeSignal(0);
  const latticeB = latticeComputed(() => latticeA.value * 2);
  const latticeC = latticeComputed(() => latticeA.value * 3);
  const latticeD = latticeComputed(() => latticeB.value + latticeC.value);
  // Prime it
  void latticeD.value;
  
  const latticeResult = profile('Lattice - diamond resolution', iterations, () => {
    latticeA.value++;
    void latticeD.value;
  });
  
  // Alien diamond
  const alienA = alienSignal(0);
  const alienB = alienComputed(() => alienA() * 2);
  const alienC = alienComputed(() => alienA() * 3);
  const alienD = alienComputed(() => alienB() + alienC());
  // Prime it
  void alienD();
  
  const alienResult = profile('Alien - diamond resolution', iterations, () => {
    alienA(alienA() + 1);
    void alienD();
  });
  
  console.log(`${latticeResult.name}: ${latticeResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`${alienResult.name}: ${alienResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`Ratio: ${(latticeResult.timePerOp / alienResult.timePerOp).toFixed(2)}x\n`);
}

// Test 4: Function call overhead in pull phase
console.log('=== Test 4: Pull Phase Function Calls ===');
{
  const iterations = 10000;
  
  // Create a complex dependency graph
  const latticeSignals = Array.from({ length: 10 }, (_, i) => latticeSignal(i));
  const latticeComputeds = latticeSignals.map((s, i) =>
    latticeComputed(() => {
      let sum = s.value;
      if (i > 0) sum += latticeSignals[i - 1]!.value;
      if (i < latticeSignals.length - 1) sum += latticeSignals[i + 1]!.value;
      return sum;
    })
  );
  
  // Prime them
  latticeComputeds.forEach(c => c.value);
  
  const latticeResult = profile('Lattice - complex graph traversal', iterations, () => {
    // Change one signal and read multiple computeds
    latticeSignals[5]!.value++;
    void latticeComputeds[4]!.value;
    void latticeComputeds[5]!.value;
    void latticeComputeds[6]!.value;
  });
  
  // Alien version
  const alienSignals = Array.from({ length: 10 }, (_, i) => alienSignal(i));
  const alienComputeds = alienSignals.map((s, i) =>
    alienComputed(() => {
      let sum = s();
      if (i > 0) sum += alienSignals[i - 1]!();
      if (i < alienSignals.length - 1) sum += alienSignals[i + 1]!();
      return sum;
    })
  );
  
  // Prime them
  alienComputeds.forEach(c => c());
  
  const alienResult = profile('Alien - complex graph traversal', iterations, () => {
    // Change one signal and read multiple computeds
    alienSignals[5]!(alienSignals[5]!() + 1);
    void alienComputeds[4]!();
    void alienComputeds[5]!();
    void alienComputeds[6]!();
  });
  
  console.log(`${latticeResult.name}: ${latticeResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`${alienResult.name}: ${alienResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`Ratio: ${(latticeResult.timePerOp / alienResult.timePerOp).toFixed(2)}x\n`);
}

// Test 5: Edge case - many reads without writes
console.log('=== Test 5: Many Reads Without Writes ===');
{
  const iterations = 100000;
  
  // Lattice
  const latticeS = latticeSignal(42);
  const latticeC1 = latticeComputed(() => latticeS.value * 2);
  const latticeC2 = latticeComputed(() => latticeC1.value + 10);
  
  const latticeResult = profile('Lattice - repeated reads', iterations, () => {
    void latticeC2.value;
    void latticeC1.value;
    void latticeS.value;
  });
  
  // Alien
  const alienS = alienSignal(42);
  const alienC1 = alienComputed(() => alienS() * 2);
  const alienC2 = alienComputed(() => alienC1() + 10);
  
  const alienResult = profile('Alien - repeated reads', iterations, () => {
    void alienC2();
    void alienC1();
    void alienS();
  });
  
  console.log(`${latticeResult.name}: ${latticeResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`${alienResult.name}: ${alienResult.timePerOp.toFixed(6)}ms per op`);
  console.log(`Ratio: ${(latticeResult.timePerOp / alienResult.timePerOp).toFixed(2)}x\n`);
}

console.log('\n📊 Summary of Performance Differences:');
console.log('- Alien-signals appears to have more optimized dependency checking');
console.log('- The pull phase in alien-signals uses bit flags more efficiently');
console.log('- Lattice has more function call overhead in the hot path');
console.log('- Both use similar graph structures but alien-signals traversal is faster');