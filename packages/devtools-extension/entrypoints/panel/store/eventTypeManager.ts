import type { DevtoolsState } from './devtoolsBehavior';

// Color palette for event types - will be assigned dynamically
const COLOR_PALETTE = [
  { main: 'text-blue-500', secondary: 'text-blue-400' },
  { main: 'text-purple-500', secondary: 'text-purple-400' },
  { main: 'text-yellow-500', secondary: 'text-yellow-400' },
  { main: 'text-green-500', secondary: 'text-green-400' },
  { main: 'text-orange-500', secondary: 'text-orange-400' },
  { main: 'text-pink-500', secondary: 'text-pink-400' },
  { main: 'text-red-500', secondary: 'text-red-400' },
  { main: 'text-indigo-500', secondary: 'text-indigo-400' },
  { main: 'text-cyan-500', secondary: 'text-cyan-400' },
  { main: 'text-teal-500', secondary: 'text-teal-400' },
];

// Track discovered event types (module-level cache for colors)
const eventTypeMap = new Map<
  string,
  { category: string; colorIndex: number }
>();
let nextColorIndex = 0;

/**
 * Create an event type manager bound to a specific devtools state instance
 */
export function createEventTypeManager(devtools: DevtoolsState) {
  /**
   * Get category for an event type - just use the event type as-is
   */
  function inferCategory(eventType: string): string {
    // Check if we've seen this event type before
    const existingMapping = eventTypeMap.get(eventType);
    if (existingMapping) {
      return existingMapping.category;
    }

    // Use the event type as the category - no inference
    const category = eventType;

    // Store the mapping with a color
    eventTypeMap.set(eventType, {
      category,
      colorIndex: nextColorIndex % COLOR_PALETTE.length,
    });
    nextColorIndex++;

    // Update available event types for filtering
    const currentTypes = devtools.availableEventTypes();
    const exists = currentTypes.some((type) => type.value === category);
    if (!exists) {
      devtools.availableEventTypes([
        ...currentTypes,
        { value: category, label: category },
      ]);
    }

    return category;
  }

  /**
   * Reset event type tracking (useful for testing or clearing state)
   */
  function resetEventTypes() {
    eventTypeMap.clear();
    nextColorIndex = 0;
    devtools.availableEventTypes([{ value: 'all', label: 'All Types' }]);
  }

  return {
    inferCategory,
    resetEventTypes,
  };
}

/**
 * Get colors for a specific category (pure function, no state needed)
 */
export function getCategoryColors(category: string): {
  main: string;
  secondary: string;
} {
  // Find any event type that maps to this category
  for (const [, mapping] of eventTypeMap) {
    if (mapping.category === category) {
      return COLOR_PALETTE[mapping.colorIndex];
    }
  }

  // Default gray for unknown categories
  return { main: 'text-gray-500', secondary: 'text-gray-400' };
}
