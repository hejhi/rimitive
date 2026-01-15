/**
 * Utility for running benchmarks with unified output handling
 * Supports both display format and JSON output for docs integration
 */
import { run as mitataRun } from 'mitata';
import * as fs from 'fs/promises';
import * as path from 'path';

// Type for mitata run options
type MitataOptions = {
  format?: 'mitata' | 'json' | { json: { debug?: boolean; samples?: boolean } };
  print?: (s: string) => void;
  [key: string]: unknown; // Allow other options
};

// Type for benchmark results from mitata JSON format
export type BenchmarkJsonResult = {
  benchmarks: Array<{
    name: string;
    group: string | null;
    time: number;
    margin: number;
    samples: number;
    min: number;
    max: number;
    p50: number;
    p75: number;
    p99: number;
    p999: number;
    args?: Record<string, unknown>;
  }>;
};

export async function runBenchmark(options?: MitataOptions): Promise<unknown> {
  // Check if we should output JSON (set by runner.ts)
  const jsonOutputPath = process.env.BENCH_JSON_OUTPUT;

  // Run with display format for nice output
  const results = await mitataRun({
    ...options,
    format: 'mitata',
  });

  // If JSON output requested, save the results object directly
  // mitata returns the benchmark data regardless of format
  if (jsonOutputPath) {
    await fs.mkdir(path.dirname(jsonOutputPath), { recursive: true });
    await fs.writeFile(jsonOutputPath, JSON.stringify(results, null, 2));
  }

  return results;
}
