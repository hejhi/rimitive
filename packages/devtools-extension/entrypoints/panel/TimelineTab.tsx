import { useEffect } from 'react';
import { useSubscribe } from '@rimitive/react';
import { History, SkipBack, SkipForward, Zap } from 'lucide-react';
import {
  timelineState,
  currentCascade,
  rebuildCascades,
  selectCascade,
  nextCascade,
  prevCascade,
} from './store/timelineState';
import { devtoolsState } from './store/devtoolsCtx';
import { TimelineScrubber } from './timeline/TimelineScrubber';
import { PropagationView } from './timeline/PropagationView';
import { CascadeDetail } from './timeline/CascadeDetail';

export function TimelineTab() {
  const state = useSubscribe(timelineState);
  const cascade = useSubscribe(currentCascade);
  const entries = useSubscribe(devtoolsState.logEntries);
  const filter = useSubscribe(devtoolsState.filter);

  // Rebuild cascades when entries or filter changes
  useEffect(() => {
    rebuildCascades();
  }, [entries, filter.hideInternal]);

  // Auto-select first cascade when cascades are available but none selected
  useEffect(() => {
    if (state.cascades.length > 0 && state.currentCascadeIndex === null) {
      selectCascade(0);
    }
  }, [state.cascades.length, state.currentCascadeIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          prevCascade();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextCascade();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Empty state
  if (state.cascades.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <History className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <div className="text-muted-foreground text-sm">
            No reactive cascades detected yet.
            <br />
            <span className="text-xs text-muted-foreground/60">
              Interact with your application to trigger signal updates.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with playback controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span>Timeline</span>
            <span className="text-muted-foreground/60">
              ({state.cascades.length} cascade{state.cascades.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        <CascadeNavigation />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Propagation visualization */}
        <div className="flex-1 min-w-0">
          <PropagationView />
        </div>

        {/* Cascade detail panel */}
        {cascade && (
          <div className="w-80 border-l border-border/50 overflow-hidden">
            <CascadeDetail />
          </div>
        )}
      </div>

      {/* Timeline scrubber */}
      <TimelineScrubber />
    </div>
  );
}

function CascadeNavigation() {
  const state = useSubscribe(timelineState);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={prevCascade}
        disabled={state.currentCascadeIndex === null || state.currentCascadeIndex === 0}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        title="Previous cascade (←)"
      >
        <SkipBack className="w-4 h-4" />
      </button>

      <button
        onClick={nextCascade}
        disabled={
          state.currentCascadeIndex === null ||
          state.currentCascadeIndex === state.cascades.length - 1
        }
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        title="Next cascade (→)"
      >
        <SkipForward className="w-4 h-4" />
      </button>

      {/* Current position */}
      {state.currentCascadeIndex !== null && (
        <span className="text-xs text-muted-foreground ml-2 font-mono">
          {state.currentCascadeIndex + 1} / {state.cascades.length}
        </span>
      )}
    </div>
  );
}
