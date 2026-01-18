import { lazy, Suspense, useCallback } from 'react';
import { useSubscribe } from '@rimitive/react';
import { Loader2 } from 'lucide-react';
import { timelineState as globalTimelineState, selectCascade as globalSelectCascade } from '../store/timelineState';
import { NODE_COLORS } from '../graph/styles';
import type { TimelineState } from '../store/timelineTypes';

// Lazy load the chart component
const TimelineChart = lazy(() =>
  import('./TimelineChart').then((m) => ({ default: m.TimelineChart }))
);

function ChartLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="w-4 h-4 text-muted-foreground/40 animate-spin" />
    </div>
  );
}

type TimelineScrubberProps = {
  /** Optional timeline state. If not provided, uses global state. */
  state?: TimelineState;
  /** Callback when a cascade is selected. Defaults to updating global state. */
  onSelectCascade?: (index: number | null) => void;
};

export function TimelineScrubber({ state: propState, onSelectCascade }: TimelineScrubberProps = {}) {
  // Use provided state or fall back to global
  const globalState = useSubscribe(globalTimelineState);
  const state = propState ?? globalState;

  const handleCascadeClick = useCallback((index: number) => {
    if (onSelectCascade) {
      onSelectCascade(index);
    } else {
      globalSelectCascade(index);
    }
  }, [onSelectCascade]);

  if (state.cascades.length === 0) {
    return (
      <div className="h-24 border-t border-border/50 bg-muted/20 flex items-center justify-center">
        <span className="text-xs text-muted-foreground/50">No timeline data</span>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 bg-muted/20">
      {/* Chart */}
      <div className="h-16 mx-2 mt-2 cursor-pointer">
        <Suspense fallback={<ChartLoading />}>
          <TimelineChart
            cascades={state.cascades}
            currentIndex={state.currentCascadeIndex}
            onCascadeClick={handleCascadeClick}
          />
        </Suspense>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-2 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-sm"
            style={{ background: NODE_COLORS.signal.border }}
          />
          signal
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-sm"
            style={{ background: NODE_COLORS.computed.border }}
          />
          computed
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-sm"
            style={{ background: NODE_COLORS.effect.border }}
          />
          effect
        </span>
      </div>
    </div>
  );
}
