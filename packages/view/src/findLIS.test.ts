import { describe, it, expect } from 'vitest';
import { findLIS } from './map';

describe('findLIS (Longest Increasing Subsequence)', () => {
  it('handles empty array', () => {
    const lisBuf: number[] = [];
    const len = findLIS([], 0, lisBuf);
    expect(len).toBe(0);
  });

  it('handles single element', () => {
    const lisBuf: number[] = [];
    const len = findLIS([5], 1, lisBuf);
    expect(len).toBe(1);
    expect(lisBuf[0]).toBe(0);
  });

  it('handles already sorted ascending sequence', () => {
    const lisBuf: number[] = [];
    const len = findLIS([1, 2, 3, 4, 5], 5, lisBuf);
    expect(len).toBe(5);
    // LIS is entire array
    expect(lisBuf.slice(0, len)).toEqual([0, 1, 2, 3, 4]);
  });

  it('handles reverse sorted (descending) sequence', () => {
    const lisBuf: number[] = [];
    const len = findLIS([5, 4, 3, 2, 1], 5, lisBuf);
    expect(len).toBe(1);
    // Any single element is valid, but algorithm returns last one
    expect(lisBuf[0]).toBe(4);
  });

  it('handles classic example [10, 9, 2, 5, 3, 7, 101, 18]', () => {
    const lisBuf: number[] = [];
    const len = findLIS([10, 9, 2, 5, 3, 7, 101, 18], 8, lisBuf);
    expect(len).toBe(4);
    // One valid LIS: [2, 3, 7, 18] or [2, 5, 7, 18] or [2, 3, 7, 101]
    // Check that indices correspond to an increasing subsequence
    const indices = lisBuf.slice(0, len);
    const values = [10, 9, 2, 5, 3, 7, 101, 18];
    for (let i = 1; i < indices.length; i++) {
      expect(values[indices[i]!]!).toBeGreaterThan(values[indices[i - 1]!]!);
    }
  });

  it('handles sequence with duplicates', () => {
    const lisBuf: number[] = [];
    const len = findLIS([1, 3, 2, 3, 4], 5, lisBuf);
    expect(len).toBe(4);
    // LIS could be [1, 2, 3, 4]
    const indices = lisBuf.slice(0, len);
    const values = [1, 3, 2, 3, 4];
    for (let i = 1; i < indices.length; i++) {
      expect(values[indices[i]!]!).toBeGreaterThan(values[indices[i - 1]!]!);
    }
  });

  it('handles all same elements', () => {
    const lisBuf: number[] = [];
    const len = findLIS([5, 5, 5, 5], 4, lisBuf);
    expect(len).toBe(1);
    // Any single element is valid
  });

  it('handles partial array using n parameter', () => {
    const lisBuf: number[] = [];
    const arr = [1, 2, 3, 4, 5, 6, 7];
    const len = findLIS(arr, 3, lisBuf); // Only consider first 3 elements
    expect(len).toBe(3);
    expect(lisBuf.slice(0, len)).toEqual([0, 1, 2]);
  });

  it('handles complex reordering case', () => {
    const lisBuf: number[] = [];
    const len = findLIS([3, 1, 4, 1, 5, 9, 2, 6], 8, lisBuf);
    expect(len).toBe(4);
    // One valid LIS: [1, 4, 5, 6] or [1, 4, 5, 9] or [3, 4, 5, 6]
    const indices = lisBuf.slice(0, len);
    const values = [3, 1, 4, 1, 5, 9, 2, 6];
    for (let i = 1; i < indices.length; i++) {
      expect(values[indices[i]!]!).toBeGreaterThan(values[indices[i - 1]!]!);
    }
  });

  it('verifies indices are in ascending order', () => {
    const lisBuf: number[] = [];
    const len = findLIS([5, 2, 8, 6, 3, 6, 9, 7], 8, lisBuf);
    const indices = lisBuf.slice(0, len);

    // Indices must be strictly increasing (represents positions in original array)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThan(indices[i - 1]!);
    }

    // Values at those indices must also be strictly increasing
    const values = [5, 2, 8, 6, 3, 6, 9, 7];
    for (let i = 1; i < indices.length; i++) {
      expect(values[indices[i]!]!).toBeGreaterThan(values[indices[i - 1]!]!);
    }
  });
});
