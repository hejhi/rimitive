/**
 * Benchmark helper utilities for preventing optimizations
 */

/**
 * Generate random integers to prevent predictable patterns
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate an array of random integers
 */
export function randomIntArray(length: number, min: number, max: number): number[] {
  return Array.from({ length }, () => randomInt(min, max));
}

/**
 * Shuffle an array in-place using Fisher-Yates
 */
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}