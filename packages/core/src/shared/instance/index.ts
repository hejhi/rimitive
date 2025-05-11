/**
 * Type guard to check if an object is a finalized instance
 * Uses a safe pattern to check for non-enumerable properties
 *
 * @param instance The object to check
 * @returns True if the object is finalized, false otherwise
 */
export function isFinalized(instance) {
  // We know the instance is a function, so check specifically for that
  if (typeof instance !== 'function') {
    return false;
  }

  // Check for the non-enumerable __finalized property
  return '__finalized' in instance && Boolean(instance.__finalized);
}

/**
 * Generic type guard for checking instance flags
 * This provides a pattern for checking any non-enumerable property
 *
 * @param instance The object to check
 * @param flagName The name of the flag property to check
 * @returns True if the flag exists and is truthy, false otherwise
 */
export function hasInstanceFlag(instance, flagName) {
  if (
    !instance ||
    (typeof instance !== 'object' && typeof instance !== 'function')
  ) {
    return false;
  }

  // Check if the property exists directly on the object (even if non-enumerable)
  return flagName in instance && Boolean(instance[flagName]);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('instance type guards', () => {
    it('should correctly identify finalized instances', () => {
      // Create a mock finalized instance
      const mockInstance = function mockFunction() {};
      Object.defineProperty(mockInstance, '__finalized', {
        value: true,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      // Should identify as finalized
      expect(isFinalized(mockInstance)).toBe(true);

      // Regular objects should not be identified as finalized
      expect(isFinalized({})).toBe(false);
      expect(isFinalized(null)).toBe(false);
      expect(isFinalized(undefined)).toBe(false);
      expect(isFinalized(function () {})).toBe(false);
    });

    it('should support checking for arbitrary instance flags', () => {
      // Create a mock instance with a custom flag
      const mockInstance = {};
      Object.defineProperty(mockInstance, '__customFlag', {
        value: true,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      // Should identify the custom flag
      expect(hasInstanceFlag(mockInstance, '__customFlag')).toBe(true);

      // Should not find non-existent flags
      expect(hasInstanceFlag(mockInstance, '__nonExistentFlag')).toBe(false);

      // Should handle edge cases
      expect(hasInstanceFlag(null, '__anyFlag')).toBe(false);
      expect(hasInstanceFlag(undefined, '__anyFlag')).toBe(false);
    });
  });
}
