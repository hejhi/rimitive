#!/usr/bin/env node

/**
 * @fileoverview Bundle Size Analysis for Benchmarks
 * 
 * Compares the bundle size impact of different reactive libraries
 * when used in similar patterns to the benchmarks.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Test implementations for bundle size comparison
const implementations = {
  lattice: {
    name: 'Lattice Core',
    code: `
import { createStore } from '@lattice/core';

const createSlice = createStore({ counter: 0 });
const counterSlice = createSlice(
  (selectors) => ({ counter: selectors.counter }),
  ({ counter }, set) => ({
    value: () => counter(),
    increment: () => set(
      (selectors) => ({ counter: selectors.counter }),
      ({ counter }) => ({ counter: counter() + 1 })
    ),
  })
);

export { counterSlice };
    `,
  },
  mobx: {
    name: 'MobX',
    code: `
import { observable, action, computed } from 'mobx';

const store = observable({ counter: 0 });
const increment = action(() => { store.counter++; });
const counter = computed(() => store.counter);

export { store, increment, counter };
    `,
  },
};

/**
 * Build and analyze bundle size for an implementation
 */
async function analyzeBundleSize(name, code) {
  const tempDir = path.join(projectRoot, 'temp', name);
  const entryFile = path.join(tempDir, 'index.js');
  
  try {
    // Create temp directory and file
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(entryFile, code);
    
    // Build with Vite
    const result = await build({
      root: tempDir,
      build: {
        write: false, // Don't write files
        minify: 'terser',
        rollupOptions: {
          input: entryFile,
          external: [], // Bundle everything
        },
      },
      logLevel: 'silent',
    });
    
    // Calculate bundle size
    const output = Array.isArray(result) ? result[0] : result;
    const totalSize = output.output.reduce((size, chunk) => {
      if (chunk.type === 'chunk') {
        return size + chunk.code.length;
      }
      return size;
    }, 0);
    
    return {
      name,
      size: totalSize,
      gzipEstimate: Math.round(totalSize * 0.3), // Rough gzip estimate
    };
    
  } catch (error) {
    console.error(`❌ Failed to analyze ${name}:`, error.message);
    return {
      name,
      size: 0,
      gzipEstimate: 0,
      error: error.message,
    };
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Main analysis function
 */
async function main() {
  console.log('📦 Bundle Size Analysis');
  console.log('━'.repeat(50));
  
  const results = [];
  
  for (const [key, impl] of Object.entries(implementations)) {
    console.log(`Analyzing ${impl.name}...`);
    const result = await analyzeBundleSize(key, impl.code);
    results.push(result);
  }
  
  // Sort by size
  results.sort((a, b) => a.size - b.size);
  
  // Display results
  console.log('\n📊 Bundle Size Results');
  console.log('━'.repeat(50));
  console.log('| Library        | Size (bytes) | Gzipped* | Relative |');
  console.log('|----------------|--------------|----------|----------|');
  
  const baseline = results[0]?.size || 1;
  
  for (const result of results) {
    if (result.error) {
      console.log(`| ${result.name.padEnd(14)} | ERROR        | ERROR    | ERROR    |`);
      continue;
    }
    
    const sizeStr = result.size.toLocaleString().padStart(12);
    const gzipStr = result.gzipEstimate.toLocaleString().padStart(8);
    const relativeStr = `${(result.size / baseline).toFixed(1)}x`.padStart(8);
    
    console.log(`| ${result.name.padEnd(14)} | ${sizeStr} | ${gzipStr} | ${relativeStr} |`);
  }
  
  console.log('\n* Gzipped size is estimated at ~30% of raw size');
  console.log('\n📝 Notes:');
  console.log('- Sizes include only the reactive core functionality');
  console.log('- Real applications may see different ratios due to tree-shaking');
  console.log('- Bundle impact depends heavily on usage patterns');
  
  // Save results
  const outputPath = path.join(projectRoot, 'dist', 'bundle-analysis.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}