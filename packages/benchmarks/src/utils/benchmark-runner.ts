/**
 * Utility for running benchmarks with unified output handling
 * Solves the problem of mitata running twice for different formats
 */
import { run as mitataRun } from 'mitata';

// Type for mitata run options
type MitataOptions = {
  format?: 'mitata' | 'json' | { json: { debug?: boolean; samples?: boolean } };
  print?: (s: string) => void;
  [key: string]: unknown; // Allow other options
};

export async function runBenchmark(options?: MitataOptions): Promise<unknown> {
  // Always use the default mitata format for display
  const results = await mitataRun({
    ...options,
    format: 'mitata', // Use default display format
  });

  return results;
}
