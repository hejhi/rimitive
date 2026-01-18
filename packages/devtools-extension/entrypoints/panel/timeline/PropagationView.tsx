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
            Propagation ({cascade.effects.length} update{cascade.effects.length !== 1 ? 's' : ''})
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
  // Sort effects by deltaMs for chronological display
  const sortedEffects = useMemo(
    () => [...cascade.effects].sort((a, b) => a.deltaMs - b.deltaMs),
    [cascade.effects]
  );

  return (
    <div className="space-y-1">
      {sortedEffects.map((effect, i) => (
        <EffectSlice key={`${effect.event.id}-${i}`} effect={effect} />
      ))}
    </div>
  );
}

function EffectSlice({ effect }: { effect: CascadeEffect }) {
  const nodeType = effect.node?.type ?? inferTypeFromEvent(effect.event.eventType);
  const colors = NODE_COLORS[nodeType];
  const name = effect.node?.name ?? effect.event.nodeName ?? 'anonymous';

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 rounded border-l-2"
      style={{
        background: `${colors.bg}80`,
        borderLeftColor: colors.border,
      }}
    >
      {/* Type badge */}
      <span
        className="text-[9px] font-medium uppercase tracking-wider w-16 shrink-0"
        style={{ color: colors.text }}
      >
        {nodeType}
      </span>

      {/* Name */}
      <span className="font-mono text-xs truncate flex-1" style={{ color: colors.text }}>
        {name}
      </span>

      {/* Summary if present */}
      {effect.event.summary && (
        <span className="text-[10px] text-foreground/60 truncate max-w-[200px] font-mono hidden sm:block">
          {effect.event.summary}
        </span>
      )}

      {/* Timing */}
      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
        +{effect.deltaMs.toFixed(1)}ms
      </span>
    </div>
  );
}

function inferTypeFromEvent(eventType: string): 'signal' | 'computed' | 'effect' | 'subscribe' {
  if (eventType.includes('computed')) return 'computed';
  if (eventType.includes('effect')) return 'effect';
  if (eventType.includes('subscribe')) return 'subscribe';
  return 'signal';
}
