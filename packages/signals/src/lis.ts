/**
 * Longest Increasing Subsequence (LIS) algorithm
 *
 * Used by reconciliation to compute minimal moves when reordering items.
 * O(n log n) using patience sorting.
 *
 * @example
 * ```ts
 * // Given old positions [2, 0, 1] (items moved from positions 2,0,1 to 0,1,2)
 * // LIS is [0, 1] - these items are already in correct relative order
 * // Only item at old position 2 needs to move
 * const lisBuf: number[] = [];
 * const lisLen = findLIS([2, 0, 1], 3, lisBuf);
 * // lisLen = 2, lisBuf = [1, 2] (indices into input array)
 * ```
 */

/**
 * Binary search for LIS algorithm - finds insertion point
 */
function binarySearch(
  arr: number[],
  tails: number[],
  len: number,
  value: number
): number {
  let lo = 0;
  let hi = len - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[tails[mid]!]! < value) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

/**
 * Find Longest Increasing Subsequence using patience sorting
 *
 * @param arr - Array of old positions
 * @param n - Length of array to process
 * @param lisBuf - Output buffer for LIS indices (indices into arr)
 * @param tailsBuf - Pre-allocated buffer for tails (must be at least size n)
 * @param parentBuf - Pre-allocated buffer for parent pointers (must be at least size n)
 * @returns Length of LIS
 */
export function findLIS(
  arr: number[],
  n: number,
  lisBuf: number[],
  tailsBuf: number[],
  parentBuf: number[]
): number {
  if (n <= 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  let len = 0;

  // Forward phase: build tails and parent pointers
  for (let i = 0; i < n; i++) {
    const pos = binarySearch(arr, tailsBuf, len, arr[i]!);
    parentBuf[i] = pos > 0 ? tailsBuf[pos - 1]! : -1;
    tailsBuf[pos] = i;
    if (pos === len) len++;
  }

  // Backtrack phase: reconstruct LIS
  for (let i = len - 1, current = tailsBuf[i]!; i >= 0; i--) {
    lisBuf[i] = current;
    current = parentBuf[current]!;
  }

  return len;
}
