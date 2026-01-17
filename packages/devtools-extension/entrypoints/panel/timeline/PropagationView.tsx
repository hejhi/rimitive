import { useMemo } from 'react';
import { useSubscribe } from '@rimitive/react';
import { Zap, ArrowRight } from 'lucide-react';
import { currentCascade } from '../store/timelineState';
import { NODE_COLORS } from '../graph/styles';
import type { Cascade, CascadeEffect } from '../store/timelineTypes';

export function PropagationView() {
  const cascade = useSubscribe(currentCascade);

  if (!cascade) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <div className="text-muted-foreground text-sm">
            Select a cascade from the timeline below
            <br />
            <span className="text-xs text-muted-foreground/60">
              or use ← → arrow keys to navigate
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      {/* Root event header */}
      <div className="mb-6">
        <div className="text-xs text-muted-foreground/60 mb-1">Root Cause</div>
        <RootEventCard cascade={cascade} />
      </div>

      {/* Propagation flow */}
      {cascade.effects.length > 0 && (
        <div className="flex-1">
          <div className="text-xs text-muted-foreground/60 mb-3 flex items-center gap-2">
            <ArrowRight className="w-3 h-3" />
            Propagation ({cascade.effects.length} effect{cascade.effects.length !== 1 ? 's' : ''})
          </div>
          <PropagationFlow cascade={cascade} />
        </div>
      )}

      {/* No effects message */}
      {cascade.effects.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground/60 text-sm">
            No downstream effects detected
            <br />
            <span className="text-xs">This signal may not have active dependents</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RootEventCard({ cascade }: { cascade: Cascade }) {
  const rootType = cascade.rootNode?.type ?? 'signal';
  const colors = NODE_COLORS[rootType];
  const name = cascade.rootNode?.name ?? cascade.rootEvent.nodeName ?? 'anonymous';

  // Extract value from summary
  const summary = cascade.rootEvent.summary ?? '';

  return (
    <div
      className="relative p-4 rounded-lg border-2 transition-all"
      style={{
        background: colors.bg,
        borderColor: colors.border,
      }}
    >
      {/* Pulse animation on root */}
      <div
        className="absolute inset-0 rounded-lg animate-pulse opacity-30"
        style={{ background: colors.border }}
      />

      <div className="relative">
        {/* Type badge */}
        <div
          className="inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider mb-2"
          style={{
            background: `${colors.border}30`,
            color: colors.text,
          }}
        >
          {rootType}
        </div>

        {/* Name */}
        <div className="font-mono text-sm font-medium" style={{ color: colors.text }}>
          {name}
        </div>

        {/* Value change */}
        {summary && (
          <div className="mt-2 font-mono text-xs text-foreground/80">{summary}</div>
        )}

        {/* Timestamp */}
        <div className="mt-2 text-[10px] text-muted-foreground">
          {new Date(cascade.rootEvent.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3,
          })}
        </div>
      </div>
    </div>
  );
}

function PropagationFlow({ cascade }: { cascade: Cascade }) {
  // Group effects by depth for layered display
  const effectsByDepth = useMemo(() => {
    const groups = new Map<number, CascadeEffect[]>();
    for (const effect of cascade.effects) {
      const depth = effect.depth || 1;
      const existing = groups.get(depth) ?? [];
      existing.push(effect);
      groups.set(depth, existing);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [cascade.effects]);

  return (
    <div className="space-y-4">
      {effectsByDepth.map(([depth, effects]) => (
        <div key={depth} className="relative">
          {/* Depth indicator */}
          <div className="absolute -left-4 top-0 bottom-0 w-px bg-border/30" />
          <div className="absolute -left-5 top-3 w-2 h-2 rounded-full bg-border/50" />

          {/* Effects at this depth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {effects.map((effect, i) => (
              <EffectCard key={`${effect.event.id}-${i}`} effect={effect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EffectCard({ effect }: { effect: CascadeEffect }) {
  const nodeType = effect.node?.type ?? inferTypeFromEvent(effect.event.eventType);
  const colors = NODE_COLORS[nodeType];
  const name = effect.node?.name ?? effect.event.nodeName ?? 'anonymous';

  return (
    <div
      className="p-3 rounded-md border"
      style={{
        background: colors.bg,
        borderColor: colors.border,
      }}
    >
      {/* Type and timing */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: colors.text }}
        >
          {nodeType}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          +{effect.deltaMs.toFixed(1)}ms
        </span>
      </div>

      {/* Name */}
      <div className="font-mono text-xs truncate" style={{ color: colors.text }}>
        {name}
      </div>

      {/* Event type */}
      <div className="text-[10px] text-muted-foreground/60 mt-1 truncate">
        {effect.event.eventType}
      </div>

      {/* Summary */}
      {effect.event.summary && (
        <div className="text-[10px] text-foreground/70 mt-1 truncate font-mono">
          {effect.event.summary}
        </div>
      )}
    </div>
  );
}

function inferTypeFromEvent(eventType: string): 'signal' | 'computed' | 'effect' | 'subscribe' {
  if (eventType.includes('computed')) return 'computed';
  if (eventType.includes('effect')) return 'effect';
  if (eventType.includes('subscribe')) return 'subscribe';
  return 'signal';
}
