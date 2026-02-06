import type { Adapter, TreeConfig } from '../adapter';

/**
 * Performance thresholds in milliseconds
 */
export type PerfThresholds = {
  /** Fast render (green) - under this value */
  fast: number;
  /** Moderate render (yellow) - under this value, above fast */
  moderate: number;
  /** Slow render (red) - at or above moderate */
};

/**
 * Performance adapter options
 */
export type PerfAdapterOptions = {
  /**
   * Flash elements based on render time
   * @default true
   */
  flashOnRender?: boolean;

  /**
   * Flash elements when their content/attributes update
   * @default true
   */
  flashOnUpdate?: boolean;

  /**
   * Highlight elements that update frequently
   * @default true
   */
  highlightFrequentUpdates?: boolean;

  /**
   * Detect long tasks (>50ms) that may cause jank
   * @default true
   */
  detectLongTasks?: boolean;

  /**
   * Time window (ms) to track update frequency
   * @default 1000
   */
  frequencyWindow?: number;

  /**
   * Number of updates within window to trigger highlight
   * @default 5
   */
  frequencyThreshold?: number;

  /**
   * Duration (ms) to show the flash
   * @default 300
   */
  flashDuration?: number;

  /**
   * Performance thresholds in milliseconds
   */
  thresholds?: Partial<PerfThresholds>;

  /**
   * Callback when a slow render is detected
   */
  onSlowRender?: (element: Element, durationMs: number) => void;

  /**
   * Callback when frequent updates are detected
   */
  onFrequentUpdate?: (element: Element, updatesInWindow: number) => void;

  /**
   * Callback when a long task is detected (>50ms, may cause jank)
   */
  onLongTask?: (durationMs: number, elements: Element[]) => void;

  /**
   * Show a recording toolbar at the top of the page
   * @default false
   */
  showToolbar?: boolean;
};

const DEFAULT_THRESHOLDS: PerfThresholds = {
  fast: 5,
  moderate: 16, // ~60fps frame budget
};

const COLORS = {
  fast: 'rgba(34, 197, 94, 0.6)', // green
  moderate: 'rgba(234, 179, 8, 0.6)', // yellow
  slow: 'rgba(239, 68, 68, 0.6)', // red
  frequent: 'rgba(168, 85, 247, 0.6)', // purple for frequent updates
  longTask: 'rgba(249, 115, 22, 0.8)', // orange for long tasks (jank)
};

/**
 * Create a performance visualization adapter that wraps another adapter.
 *
 * Features:
 * - Flashes elements based on render time (green/yellow/red)
 * - Highlights elements that update frequently (purple)
 * - Detects long tasks that cause jank (orange, uses PerformanceObserver)
 * - Provides callbacks for slow renders, frequent updates, and long tasks
 *
 * @example
 * ```typescript
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 * import { createPerfAdapter } from '@rimitive/view/adapters/perf';
 *
 * const perfAdapter = createPerfAdapter(createDOMAdapter(), {
 *   thresholds: { fast: 5, moderate: 16 },
 *   onSlowRender: (el, ms) => console.warn('Slow render:', ms, 'ms', el),
 *   onLongTask: (ms, els) => console.warn('Long task:', ms, 'ms', els),
 * });
 *
 * // Use perfAdapter instead of domAdapter
 * const svc = compose(..., createElModule(perfAdapter));
 * ```
 */
export function createPerfAdapter<TConfig extends TreeConfig>(
  baseAdapter: Adapter<TConfig>,
  options: PerfAdapterOptions = {}
): Adapter<TConfig> {
  const {
    flashOnRender = true,
    flashOnUpdate = true,
    highlightFrequentUpdates = true,
    detectLongTasks = true,
    frequencyWindow = 1000,
    frequencyThreshold = 5,
    flashDuration = 300,
    thresholds: userThresholds,
    onSlowRender,
    onFrequentUpdate,
    onLongTask,
    showToolbar = false,
  } = options;

  const thresholds = { ...DEFAULT_THRESHOLDS, ...userThresholds };

  const nodeStartTimes = new WeakMap<object, number>();
  const updateHistory = new WeakMap<Element, number[]>();

  // DevTools color mapping (from Chrome's extensibility API)
  type DevToolsColor = 'primary' | 'primary-light' | 'primary-dark' |
    'secondary' | 'secondary-light' | 'secondary-dark' |
    'tertiary' | 'tertiary-light' | 'tertiary-dark' | 'error';

  const getDevToolsColor = (durationMs: number): DevToolsColor => {
    if (durationMs < thresholds.fast) return 'primary'; // green-ish
    if (durationMs < thresholds.moderate) return 'tertiary'; // yellow-ish
    return 'error'; // red
  };

  const getElementLabel = (node: unknown): string => {
    if (node instanceof Element) {
      const tag = node.tagName.toLowerCase();
      const id = node.id ? `#${node.id}` : '';
      const cls = node.className && typeof node.className === 'string'
        ? `.${node.className.split(' ')[0]}`
        : '';
      return `${tag}${id || cls || ''}`;
    }
    if (node instanceof Text) return '#text';
    return 'node';
  };

  // Stats tracking
  const stats = { mounts: 0, updates: 0, slow: 0, longTasks: 0 };

  // Toolbar elements (created lazily)
  let toolbar: { update: () => void } | null = null;

  if (showToolbar && typeof document !== 'undefined') {
    const barHeight = 29;
    document.body.style.paddingTop = `${barHeight}px`;

    const bar = document.createElement('div');
    bar.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 999999; height: ${barHeight}px; box-sizing: border-box;
      background: #fffbe6; color: #5c5c00; border-bottom: 1px solid #e6dfa7;
      font: 12px/1.4 ui-monospace, monospace; padding: 6px 12px;
      display: flex; align-items: center; gap: 16px;
    `;

    const statsEl = document.createElement('span');
    statsEl.style.cssText = 'display: flex; gap: 16px;';

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `
      background: #f5f5f4; color: #292524; border: 1px solid #d4d4d4;
      border-radius: 3px; padding: 2px 8px; cursor: pointer; font: inherit;
    `;

    const updateToolbar = () => {
      statsEl.innerHTML = `
        <span>Mounts: <b>${stats.mounts}</b></span>
        <span>Updates: <b>${stats.updates}</b></span>
        <span style="color: ${stats.slow ? '#b91c1c' : 'inherit'}">Slow: <b>${stats.slow}</b></span>
        <span style="color: ${stats.longTasks ? '#b91c1c' : 'inherit'}">Long tasks: <b>${stats.longTasks}</b></span>
      `;
    };

    clearBtn.onclick = () => {
      stats.mounts = 0;
      stats.updates = 0;
      stats.slow = 0;
      stats.longTasks = 0;
      updateToolbar();
    };

    bar.append(statsEl, clearBtn);
    document.body.prepend(bar);

    toolbar = { update: updateToolbar };
    updateToolbar();
  }

  // Track recently rendered elements for long task correlation
  const recentElements = new Set<Element>();
  let clearRecentTimeout: ReturnType<typeof setTimeout> | null = null;
  let isWarmedUp = false;

  // Skip long task detection until browser is idle (initial render complete)
  requestIdleCallback(() => {
    isWarmedUp = true;
  });

  const trackElement = (node: unknown) => {
    if (!isWarmedUp) return;

    const element = getElement(node);
    if (!element) return;

    recentElements.add(element);

    // Clear recent elements after a window - long enough to catch long tasks
    if (clearRecentTimeout) clearTimeout(clearRecentTimeout);
    clearRecentTimeout = setTimeout(() => recentElements.clear(), 200);
  };

  // Set up long task observer
  if (detectLongTasks && typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        if (!isWarmedUp) return;

        for (const entry of list.getEntries()) {
          if (entry.duration > 50 && recentElements.size > 0) {
            const elements = Array.from(recentElements);
            stats.longTasks++;
            toolbar?.update();
            onLongTask?.(entry.duration, elements);

            // Emit DevTools track entry for long task
            performance.measure(`⚠️ Long Task`, {
              start: entry.startTime,
              duration: entry.duration,
              detail: {
                devtools: {
                  dataType: 'track-entry',
                  track: 'Rimitive DOM',
                  color: 'error',
                  properties: [
                    ['Duration', `${entry.duration.toFixed(0)}ms`],
                    ['Elements', `${elements.length} affected`],
                    ['Threshold', '>50ms causes jank'],
                  ],
                  tooltipText: `Long task: ${entry.duration.toFixed(0)}ms may cause jank`,
                },
              },
            });

            // Flash all recently rendered elements with long task color
            for (const el of elements) {
              el.animate(
                [
                  {
                    outline: `3px solid ${COLORS.longTask}`,
                    boxShadow: `0 0 15px ${COLORS.longTask}`,
                  },
                  {
                    outline: '3px solid transparent',
                    boxShadow: '0 0 15px transparent',
                  },
                ],
                { duration: flashDuration * 2, easing: 'ease-out' }
              );
            }
          }
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // longtask not supported in this browser
    }
  }

  const getColor = (durationMs: number): string => {
    if (durationMs < thresholds.fast) return COLORS.fast;
    if (durationMs < thresholds.moderate) return COLORS.moderate;
    return COLORS.slow;
  };

  const getElement = (node: unknown): HTMLElement | null => {
    if (node instanceof Element) return node as HTMLElement;
    if (node instanceof Node && node.parentElement) return node.parentElement;
    return null;
  };

  const flashElement = (node: unknown, color: string) => {
    const element = getElement(node);
    if (!element) return;

    element.animate(
      [
        { outline: `2px solid ${color}`, boxShadow: `0 0 10px ${color}` },
        { outline: '2px solid transparent', boxShadow: '0 0 10px transparent' },
      ],
      { duration: flashDuration, easing: 'ease-out' }
    );
  };

  const checkFrequency = (node: unknown): boolean => {
    if (!highlightFrequentUpdates) return false;

    const element = getElement(node);
    if (!element) return false;

    const now = performance.now();
    const history = updateHistory.get(element) ?? [];
    const recent = history.filter((t) => now - t < frequencyWindow);
    recent.push(now);
    updateHistory.set(element, recent);

    if (recent.length >= frequencyThreshold) {
      // Emit DevTools track entry for frequent updates
      const label = getElementLabel(element);
      performance.measure(`⚡ Frequent <${label}>`, {
        start: now - 1, // tiny duration just to mark the moment
        end: now,
        detail: {
          devtools: {
            dataType: 'track-entry',
            track: 'Rimitive DOM',
            color: 'secondary',
            properties: [
              ['Element', label],
              ['Updates', `${recent.length} in ${frequencyWindow}ms`],
            ],
            tooltipText: `${recent.length} updates in ${frequencyWindow}ms`,
          },
        },
      });

      onFrequentUpdate?.(element, recent.length);
      return true;
    }
    return false;
  };

  const measureRender = (node: unknown): number | null => {
    const startTime = nodeStartTimes.get(node as object);
    if (startTime === undefined) return null;

    const duration = performance.now() - startTime;
    const label = getElementLabel(node);

    // Emit DevTools track entry
    performance.measure(`Mount <${label}>`, {
      start: startTime,
      end: performance.now(),
      detail: {
        devtools: {
          dataType: 'track-entry',
          track: 'Rimitive DOM',
          color: getDevToolsColor(duration),
          properties: [
            ['Element', label],
            ['Duration', `${duration.toFixed(2)}ms`],
          ],
          tooltipText: `Mounted <${label}> in ${duration.toFixed(2)}ms`,
        },
      },
    });

    nodeStartTimes.delete(node as object);
    return duration;
  };

  const handleAttach = (child: unknown) => {
    trackElement(child);

    if (!flashOnRender) return;

    const duration = measureRender(child);
    if (duration === null) return;

    stats.mounts++;
    if (duration >= thresholds.moderate) {
      stats.slow++;
      if (child instanceof Element) onSlowRender?.(child, duration);
    }
    toolbar?.update();

    flashElement(child, getColor(duration));
  };

  return {
    createNode: (type, props, parentContext) => {
      const startTime = performance.now();
      const node = baseAdapter.createNode(type, props, parentContext);
      nodeStartTimes.set(node as object, startTime);
      return node;
    },

    setAttribute: (node, key, value) => {
      const startTime = performance.now();
      baseAdapter.setAttribute(node, key, value);
      const duration = performance.now() - startTime;

      const label = getElementLabel(node);

      // Emit DevTools track entry
      performance.measure(`Update <${label}> ${String(key)}`, {
        start: startTime,
        end: performance.now(),
        detail: {
          devtools: {
            dataType: 'track-entry',
            track: 'Rimitive DOM',
            color: getDevToolsColor(duration),
            properties: [
              ['Element', label],
              ['Attribute', String(key)],
              ['Duration', `${duration.toFixed(2)}ms`],
            ],
            tooltipText: `Updated ${String(key)} on <${label}> in ${duration.toFixed(2)}ms`,
          },
        },
      });

      // Track for long task correlation
      trackElement(node);

      stats.updates++;
      toolbar?.update();

      if (checkFrequency(node)) {
        flashElement(node, COLORS.frequent);
      } else if (flashOnUpdate) {
        flashElement(node, getColor(duration));
      }
    },

    appendChild: (parent, child) => {
      baseAdapter.appendChild(parent, child);
      handleAttach(child);
    },

    removeChild: (parent, child) => {
      baseAdapter.removeChild(parent, child);
    },

    insertBefore: (parent, child, reference) => {
      baseAdapter.insertBefore(parent, child, reference);
      handleAttach(child);
    },

    beforeCreate: baseAdapter.beforeCreate,
    onCreate: baseAdapter.onCreate,
    beforeAttach: baseAdapter.beforeAttach,
    onAttach: baseAdapter.onAttach,
    beforeDestroy: baseAdapter.beforeDestroy,
    onDestroy: baseAdapter.onDestroy,
    createShadowRoot: baseAdapter.createShadowRoot,
  };
}
