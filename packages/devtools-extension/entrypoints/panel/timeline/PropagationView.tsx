import { useMemo } from 'react';
import { useSubscribe } from '@rimitive/react';
import { Zap, ArrowRight } from 'lucide-react';
import { currentCascade } from '../store/timelineState';
import { LogLine } from '../components/LogLine';
import type { Cascade } from '../store/timelineTypes';

export function PropagationView() {
  const cascade = useSubscribe(currentCascade);

  // Sort effects by deltaMs for chronological display
  const sortedEffects = useMemo(
    () => (cascade ? [...cascade.effects].sort((a, b) => a.deltaMs - b.deltaMs) : []),
    [cascade]
  );

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
    <div className="h-full overflow-auto">
      <div className="p-4">
        {/* Root event header */}
        <div className="mb-6">
          <div className="text-xs text-muted-foreground/60 mb-1">Root Cause</div>
          <RootEventCard cascade={cascade} />
        </div>

        {/* Propagation flow - exact same structure as LogsTab */}
        {sortedEffects.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground/60 mb-3 flex items-center gap-2">
              <ArrowRight className="w-3 h-3" />
              Propagation ({sortedEffects.length} update{sortedEffects.length !== 1 ? 's' : ''})
            </div>
            <div className="font-mono text-xs space-y-1">
              {sortedEffects.map((effect, i) => (
                <LogLine
                  key={`${effect.event.id}-${i}`}
                  entry={effect.event}
                  leftColumn={`+${effect.deltaMs.toFixed(1)}ms`}
                />
              ))}
            </div>
          </div>
        )}

        {/* No effects message */}
        {sortedEffects.length === 0 && (
          <div className="text-center text-muted-foreground/60 text-sm py-8">
            No downstream effects detected
            <br />
            <span className="text-xs">This signal may not have active dependents</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RootEventCard({ cascade }: { cascade: Cascade }) {
  const timestamp = new Date(cascade.rootEvent.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  return (
    <div className="font-mono text-xs">
      <LogLine entry={cascade.rootEvent} leftColumn={timestamp} />
    </div>
  );
}
