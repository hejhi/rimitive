import { useSubscribe } from '@rimitive/react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { currentCascade } from '../store/timelineState';
import { NODE_COLORS } from '../graph/styles';
import { ValueDisplay } from '../components/ValueDisplay';
import type { SourceLocation } from '../store/types';
import type { CascadeEffect } from '../store/timelineTypes';

export function CascadeDetail() {
  const cascade = useSubscribe(currentCascade);

  if (!cascade) {
    return null;
  }

  const rootType = cascade.rootNode?.type ?? 'signal';
  const rootColors = NODE_COLORS[rootType];
  const rootName = cascade.rootNode?.name ?? cascade.rootEvent.nodeName ?? 'anonymous';

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">
          Cascade Detail
        </div>
        <div className="text-xs text-foreground">
          {cascade.effects.length + 1} node{cascade.effects.length !== 0 ? 's' : ''} affected
        </div>
      </div>

      {/* Tree view */}
      <div className="flex-1 overflow-auto p-2 font-mono text-xs">
        {/* Root event */}
        <TreeNode
          type={rootType}
          name={rootName}
          eventType={cascade.rootEvent.eventType}
          summary={cascade.rootEvent.summary}
          sourceLocation={cascade.rootEvent.sourceLocation}
          deltaMs={0}
          isRoot
        />

        {/* Effects */}
        {cascade.effects.map((effect, i) => (
          <TreeNode
            key={`${effect.event.id}-${i}`}
            type={effect.node?.type ?? inferTypeFromEvent(effect.event.eventType)}
            name={effect.node?.name ?? effect.event.nodeName ?? 'anonymous'}
            eventType={effect.event.eventType}
            summary={effect.event.summary}
            sourceLocation={effect.event.sourceLocation}
            deltaMs={effect.deltaMs}
            depth={effect.depth}
          />
        ))}
      </div>

      {/* Footer with timing stats */}
      <div className="px-3 py-2 border-t border-border/30 text-[10px] text-muted-foreground/60">
        <div className="flex justify-between">
          <span>Total duration</span>
          <span className="font-mono">
            {(cascade.endTime - cascade.startTime).toFixed(1)}ms
          </span>
        </div>
      </div>
    </div>
  );
}

function TreeNode({
  type,
  name,
  eventType,
  summary,
  sourceLocation,
  deltaMs,
  depth = 0,
  isRoot = false,
}: {
  type: 'signal' | 'computed' | 'effect' | 'subscribe';
  name: string;
  eventType: string;
  summary?: string;
  sourceLocation?: SourceLocation;
  deltaMs: number;
  depth?: number;
  isRoot?: boolean;
}) {
  const colors = NODE_COLORS[type];
  const indent = depth * 12;

  return (
    <div
      className="group relative py-1.5 hover:bg-accent/30 rounded-sm transition-colors cursor-default"
      style={{ paddingLeft: indent + 8 }}
    >
      {/* Tree lines */}
      {!isRoot && (
        <>
          {/* Vertical line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-border/30"
            style={{ left: indent + 4 }}
          />
          {/* Horizontal connector */}
          <div
            className="absolute top-3 h-px bg-border/30"
            style={{ left: indent + 4, width: 8 }}
          />
          {/* Elbow */}
          <div
            className="absolute top-2 w-1.5 h-1.5 rounded-full border border-border/50"
            style={{ left: indent + 1 }}
          />
        </>
      )}

      {/* Content */}
      <div className="flex items-start gap-2">
        {/* Type indicator */}
        <div
          className="mt-0.5 w-2 h-2 rounded-sm flex-shrink-0"
          style={{ background: colors.border }}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Name and timing */}
          <div className="flex items-center justify-between gap-2">
            <span className="truncate" style={{ color: colors.text }}>
              {name}
            </span>
            <span className="flex-shrink-0 text-muted-foreground/60">
              {isRoot ? (
                <span className="text-accent">root</span>
              ) : (
                `+${deltaMs.toFixed(1)}ms`
              )}
            </span>
          </div>

          {/* Event type */}
          <div className="text-muted-foreground/50 text-[10px] truncate">
            {eventType}
          </div>

          {/* Summary (value change) */}
          {summary && (
            <div className="mt-0.5">
              <ValueDisplay value={summary} mode="collapsed" />
            </div>
          )}

          {/* Source location */}
          {sourceLocation && (
            <button
              onClick={() => openInEditor(sourceLocation)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-accent mt-0.5 group/link"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              <span className="truncate group-hover/link:underline">
                {sourceLocation.display}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function openInEditor(location: SourceLocation) {
  chrome.devtools.panels.openResource(
    location.filePath,
    location.line - 1,
    location.column ?? 0,
    () => {}
  );
}

function inferTypeFromEvent(
  eventType: string
): 'signal' | 'computed' | 'effect' | 'subscribe' {
  if (eventType.includes('computed')) return 'computed';
  if (eventType.includes('effect')) return 'effect';
  if (eventType.includes('subscribe')) return 'subscribe';
  return 'signal';
}
