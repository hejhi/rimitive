/**
 * Performance API instrumentation provider
 *
 * Outputs instrumentation events to Chrome DevTools Performance panel
 * using custom tracks via the User Timing API.
 *
 * @example
 * ```ts
 * import { createInstrumentation, perfProvider } from '@rimitive/core';
 *
 * const instrumentation = createInstrumentation({
 *   providers: [perfProvider()],
 * });
 *
 * const svc = compose(SignalModule, ComputedModule, EffectModule, { instrumentation });
 * ```
 */

import type { InstrumentationProvider, InstrumentationEvent } from './types';

/**
 * DevTools color palette (from Chrome's extensibility API)
 */
type DevToolsColor =
  | 'primary'
  | 'primary-light'
  | 'primary-dark'
  | 'secondary'
  | 'secondary-light'
  | 'secondary-dark'
  | 'tertiary'
  | 'tertiary-light'
  | 'tertiary-dark'
  | 'error';

/**
 * Configuration for the performance provider
 */
export type PerfProviderOptions = {
  /**
   * Track name for signal/computed/effect events
   * @default 'Rimitive Signals'
   */
  signalsTrack?: string;

  /**
   * Track name for view primitive events (el, map, match)
   * @default 'Rimitive View'
   */
  viewTrack?: string;

  /**
   * Include signal reads (can be noisy)
   * @default false
   */
  includeReads?: boolean;

  /**
   * Show internal framework signals/computed/effects (from @rimitive packages)
   * @default false
   */
  showInternal?: boolean;

  /**
   * Threshold (ms) above which to use warning color
   * @default 1
   */
  slowThreshold?: number;
};

// Track start times for duration-based events
const eventStartTimes = new Map<string, number>();

/**
 * Format a value for display in DevTools
 */
function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `{...}`;
  return String(value);
}

/**
 * Emit a performance measure with DevTools track entry
 */
function emitTrackEntry(
  label: string,
  track: string,
  color: DevToolsColor,
  startTime: number,
  endTime: number,
  properties: [string, string][]
): void {
  try {
    performance.measure(label, {
      start: startTime,
      end: endTime,
      detail: {
        devtools: {
          dataType: 'track-entry',
          track,
          color,
          properties,
          tooltipText: label,
        },
      },
    });
  } catch {
    // Performance API not available or measure failed
  }
}

/**
 * Create a Performance API instrumentation provider.
 *
 * This provider outputs instrumentation events to Chrome DevTools Performance panel
 * as custom track entries. Record a performance profile to see signal writes,
 * computed recalculations, and effect runs on a timeline.
 *
 * @example Basic usage
 * ```ts
 * import { createInstrumentation, perfProvider } from '@rimitive/core';
 *
 * const instrumentation = createInstrumentation({
 *   providers: [perfProvider()],
 * });
 *
 * const svc = compose(SignalModule, ComputedModule, EffectModule, { instrumentation });
 * // Now record a Performance profile - you'll see Rimitive tracks!
 * ```
 *
 * @example With devtools provider (both custom panel + Performance timeline)
 * ```ts
 * const instrumentation = createInstrumentation({
 *   providers: [
 *     devtoolsProvider(),
 *     perfProvider({ includeReads: false }),
 *   ],
 * });
 * ```
 *
 * @example Custom track names
 * ```ts
 * const instrumentation = createInstrumentation({
 *   providers: [
 *     perfProvider({
 *       signalsTrack: 'My App Signals',
 *       viewTrack: 'My App View',
 *     }),
 *   ],
 * });
 * ```
 *
 * @example Show internal framework events (hidden by default)
 * ```ts
 * const instrumentation = createInstrumentation({
 *   providers: [
 *     perfProvider({
 *       showInternal: true, // Show signals/effects from @rimitive packages
 *     }),
 *   ],
 * });
 * ```
 */
/**
 * Check if an event originates from internal framework code
 */
function isInternalEvent(event: InstrumentationEvent): boolean {
  const sourceLocation = event.data.sourceLocation as
    | { filePath?: string }
    | undefined;
  if (!sourceLocation?.filePath) return false;

  // Check if the file path contains @rimitive or node_modules/@rimitive
  const filePath = sourceLocation.filePath;
  return (
    filePath.includes('@rimitive/') ||
    filePath.includes('/rimitive/packages/') ||
    filePath.includes('node_modules/@rimitive')
  );
}

export function perfProvider(
  options: PerfProviderOptions = {}
): InstrumentationProvider {
  const {
    signalsTrack = 'Rimitive Signals',
    viewTrack = 'Rimitive View',
    includeReads = false,
    showInternal = false,
    slowThreshold = 1,
  } = options;

  // Track registered resource names by ID
  const resourceNames = new Map<string, string>();

  return {
    name: 'perf',

    init() {
      // Nothing to initialize
    },

    emit(event: InstrumentationEvent): void {
      const now = performance.now();

      // Filter out internal framework events unless showInternal is true
      if (!showInternal && isInternalEvent(event)) {
        // Still track start times for computed duration calculation
        if (event.type === 'computed:read') {
          const { computedId } = event.data as { computedId: string };
          eventStartTimes.set(`computed:${computedId}`, now);
        }
        return;
      }

      switch (event.type) {
        // Signal events
        case 'signal:write': {
          const { signalId, name, oldValue, newValue } = event.data as {
            signalId: string;
            name: string;
            oldValue: unknown;
            newValue: unknown;
          };

          const label = `Signal ${name ?? signalId}`;
          emitTrackEntry(
            label,
            signalsTrack,
            'primary', // green-ish for state changes
            now - 0.1, // tiny duration to mark the moment
            now,
            [
              ['Signal', name ?? signalId],
              ['Change', `${formatValue(oldValue)} → ${formatValue(newValue)}`],
            ]
          );
          break;
        }

        case 'signal:read': {
          if (!includeReads) break;

          const { signalId, name, value } = event.data as {
            signalId: string;
            name: string;
            value: unknown;
          };

          const label = `Read ${name ?? signalId}`;
          emitTrackEntry(label, signalsTrack, 'primary-light', now - 0.05, now, [
            ['Signal', name ?? signalId],
            ['Value', formatValue(value)],
          ]);
          break;
        }

        // Computed events
        // computed:read is emitted before computation, computed:value after
        case 'computed:read': {
          const { computedId } = event.data as { computedId: string };
          // Store start time for duration calculation
          eventStartTimes.set(`computed:${computedId}`, now);
          break;
        }

        case 'computed:value': {
          const { computedId, name, value } = event.data as {
            computedId: string;
            name: string;
            value: unknown;
          };

          const startTime = eventStartTimes.get(`computed:${computedId}`);
          eventStartTimes.delete(`computed:${computedId}`);

          // Use start time if we have it, otherwise just mark the moment
          const effectiveStart = startTime ?? now - 0.1;
          const duration = now - effectiveStart;
          const color: DevToolsColor =
            duration > slowThreshold ? 'tertiary' : 'tertiary-light';

          const displayName = name ?? resourceNames.get(computedId) ?? computedId;
          const label = `Computed ${displayName}`;

          emitTrackEntry(label, signalsTrack, color, effectiveStart, now, [
            ['Computed', displayName],
            ['Duration', `${duration.toFixed(2)}ms`],
            ['Value', formatValue(value)],
          ]);
          break;
        }

        // Effect events
        // effect:run is emitted when the effect runs (single event, no duration)
        case 'effect:run': {
          const { effectId, name } = event.data as {
            effectId: string;
            name?: string;
          };

          const displayName = name ?? resourceNames.get(effectId) ?? 'effect';
          const label = `Effect ${displayName}`;

          // Single point event - tiny duration to mark the moment
          emitTrackEntry(label, signalsTrack, 'secondary', now - 0.1, now, [
            ['Effect', displayName],
          ]);
          break;
        }

        case 'effect:dispose': {
          const { effectId, name } = event.data as {
            effectId: string;
            name?: string;
          };

          const displayName = name ?? resourceNames.get(effectId) ?? 'effect';
          emitTrackEntry(
            `Dispose ${displayName}`,
            signalsTrack,
            'secondary-dark',
            now - 0.1,
            now,
            [['Effect', displayName], ['Action', 'disposed']]
          );
          break;
        }

        // Batch events
        case 'batch:start': {
          eventStartTimes.set('batch', now);
          break;
        }

        case 'batch:end': {
          const startTime = eventStartTimes.get('batch');
          eventStartTimes.delete('batch');

          if (startTime === undefined) break;

          const duration = now - startTime;
          emitTrackEntry(
            'Batch',
            signalsTrack,
            duration > slowThreshold ? 'error' : 'primary-dark',
            startTime,
            now,
            [['Duration', `${duration.toFixed(2)}ms`]]
          );
          break;
        }

        // View events
        case 'el:create': {
          const { tag, childCount } = event.data as {
            tag: string;
            childCount: number;
          };

          emitTrackEntry(
            `el(${tag})`,
            viewTrack,
            'primary',
            now - 0.1,
            now,
            [
              ['Tag', tag],
              ['Children', String(childCount)],
            ]
          );
          break;
        }

        case 'map:create': {
          const { hasKeyFn } = event.data as { hasKeyFn: boolean };

          emitTrackEntry(
            'map()',
            viewTrack,
            'tertiary',
            now - 0.1,
            now,
            [['Has Key Function', hasKeyFn ? 'yes' : 'no']]
          );
          break;
        }

        case 'match:create': {
          emitTrackEntry(
            'match()',
            viewTrack,
            'secondary',
            now - 0.1,
            now,
            []
          );
          break;
        }
      }
    },

    register<T>(
      resource: T,
      _type: string,
      name?: string
    ): { id: string; resource: T } {
      const id = crypto.randomUUID();
      if (name) resourceNames.set(id, name);
      return { id, resource };
    },

    dispose(): void {
      eventStartTimes.clear();
      resourceNames.clear();
    },
  };
}
