import { useEffect, useCallback } from 'react';
import { useSubscribe } from '@rimitive/react';
import { History, SkipBack, SkipForward, Zap } from 'lucide-react';
import {
  timelineState as globalTimelineState,
  rebuildCascades,
  selectCascade as globalSelectCascade,
  currentCascade as globalCurrentCascade,
  snapshotTimelineState,
  rebuildSnapshotCascades,
  selectSnapshotCascade,
  currentSnapshotCascade,
} from './store/timelineState';
import { devtoolsState } from './store/devtoolsCtx';
import { snapshotContextFilteredEntries } from './store/computed';
import { TimelineScrubber } from './timeline/TimelineScrubber';
import { PropagationView } from './timeline/PropagationView';
import type { TimelineState } from './store/timelineTypes';

type TimelineTabProps = {
  /** Whether viewing a snapshot (uses snapshot state) */
  snapshotMode?: boolean;
  /** Whether to hide internal entries. Defaults to global filter setting. */
  hideInternal?: boolean;
};

export function TimelineTab({ snapshotMode = false, hideInternal: propHideInternal }: TimelineTabProps = {}) {
  // Subscribe to the appropriate state based on mode
  const globalState = useSubscribe(globalTimelineState);
  const snapshotState = useSubscribe(snapshotTimelineState);
  const snapshotEntries = useSubscribe(snapshotContextFilteredEntries);
  const globalEntries = useSubscribe(devtoolsState.logEntries);
  const globalFilter = useSubscribe(devtoolsState.filter);
  const globalSelectedContext = useSubscribe(devtoolsState.selectedContext);
  const snapshotFilter = useSubscribe(devtoolsState.snapshotFilter);

  // Subscribe to current cascade computed
  const globalCurrent = useSubscribe(globalCurrentCascade);
  const snapshotCurrent = useSubscribe(currentSnapshotCascade);

  // Use snapshot or global state based on mode
  const state = snapshotMode ? snapshotState : globalState;
  const currentCascade = snapshotMode ? snapshotCurrent : globalCurrent;
  const hideInternal = propHideInternal ?? (snapshotMode ? snapshotFilter.hideInternal : globalFilter.hideInternal);

  // Build/rebuild cascades when dependencies change
  useEffect(() => {
    if (snapshotMode) {
      rebuildSnapshotCascades(snapshotEntries, hideInternal);
    } else {
      rebuildCascades();
    }
  }, [snapshotMode, snapshotEntries, globalEntries, globalFilter.hideInternal, globalSelectedContext, hideInternal]);

  // Selection handlers
  const selectCascade = useCallback((index: number | null) => {
    if (snapshotMode) {
      selectSnapshotCascade(index);
    } else {
      globalSelectCascade(index);
    }
  }, [snapshotMode]);

  const nextCascade = useCallback(() => {
    if (state.cascades.length === 0) return;
    const nextIndex = state.currentCascadeIndex === null
      ? 0
      : Math.min(state.currentCascadeIndex + 1, state.cascades.length - 1);
    selectCascade(nextIndex);
  }, [state.cascades.length, state.currentCascadeIndex, selectCascade]);

  const prevCascade = useCallback(() => {
    if (state.cascades.length === 0) return;
    const prevIndex = state.currentCascadeIndex === null
      ? state.cascades.length - 1
      : Math.max(state.currentCascadeIndex - 1, 0);
    selectCascade(prevIndex);
  }, [state.cascades.length, state.currentCascadeIndex, selectCascade]);

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
  }, [nextCascade, prevCascade]);

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

        <CascadeNavigation state={state} onPrev={prevCascade} onNext={nextCascade} />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PropagationView cascade={currentCascade} />
      </div>

      {/* Timeline scrubber */}
      <TimelineScrubber
        state={state}
        onSelectCascade={selectCascade}
      />
    </div>
  );
}

type CascadeNavigationProps = {
  state: TimelineState;
  onPrev: () => void;
  onNext: () => void;
};

function CascadeNavigation({ state, onPrev, onNext }: CascadeNavigationProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPrev}
        disabled={state.currentCascadeIndex === null || state.currentCascadeIndex === 0}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        title="Previous cascade (←)"
      >
        <SkipBack className="w-4 h-4" />
      </button>

      <button
        onClick={onNext}
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
