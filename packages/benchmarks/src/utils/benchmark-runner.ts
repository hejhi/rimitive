/**
 * Utility for running benchmarks with unified output handling
 * Solves the problem of mitata running twice for different formats
 */
import { run as mitataRun } from 'mitata';

export async function runBenchmark(options?: any) {
  if (process.env.BENCHMARK_FORMAT === 'both') {
    // Single run with both formats - display to stderr, JSON to stdout
    const results = await mitataRun({ 
      ...options,
      format: 'mitata', // Use default display format
      print: (s: string) => process.stderr.write(s + '\n') // Output display to stderr
    });
    
    // Output JSON data to stdout for capture (compact, no pretty printing)
    console.log(JSON.stringify(results));
    return results;
  } else {
    // Normal single-format run
    const format = process.env.BENCHMARK_FORMAT === 'json' 
      ? { json: { debug: false, samples: false } }
      : options?.format;
    
    const results = await mitataRun({ ...options, format });
    
    if (process.env.BENCHMARK_FORMAT === 'json') {
      console.log(JSON.stringify(results));
    }
    
    return results;
  }
}