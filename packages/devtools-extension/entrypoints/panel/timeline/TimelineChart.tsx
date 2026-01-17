import { useState, useCallback, useEffect, useRef } from 'react';
import { NODE_COLORS } from '../graph/styles';
import type { Cascade } from '../store/timelineTypes';

type TimelineChartProps = {
  cascades: Cascade[];
  currentIndex: number | null;
  onCascadeClick: (index: number) => void;
};

const MARGIN = { top: 4, right: 8, bottom: 4, left: 8 };
const BAR_GAP = 3;
const MIN_BAR_WIDTH = 8;
const MAX_BAR_WIDTH = 24;

export function TimelineChart({
  cascades,
  currentIndex,
  onCascadeClick,
}: TimelineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Measure container and re-measure on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      setDimensions({ width, height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const innerWidth = dimensions.width - MARGIN.left - MARGIN.right;
  const innerHeight = dimensions.height - MARGIN.top - MARGIN.bottom;

  // Calculate bar width based on number of cascades
  const totalGapWidth = (cascades.length - 1) * BAR_GAP;
  const availableWidth = innerWidth - totalGapWidth;
  const barWidth = Math.max(
    MIN_BAR_WIDTH,
    Math.min(MAX_BAR_WIDTH, availableWidth / cascades.length)
  );

  // Calculate total content width - bars start from left
  const contentWidth = cascades.length * barWidth + totalGapWidth;

  // Find max effect count for scaling
  const maxEffects = Math.max(...cascades.map((c) => c.effects.length + 1), 1);

  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 1,
    });
  }, []);

  const hoveredCascade = hoverIndex !== null ? cascades[hoverIndex] : null;

  // Auto-scroll to show the current selection
  useEffect(() => {
    if (currentIndex !== null && scrollRef.current) {
      const scrollLeft = currentIndex * (barWidth + BAR_GAP) - dimensions.width / 2 + barWidth / 2;
      scrollRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [currentIndex, barWidth, dimensions.width]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Scrollable chart area */}
      <div ref={scrollRef} className="w-full h-full overflow-x-auto">
        <svg
          width={Math.max(dimensions.width, contentWidth + MARGIN.left + MARGIN.right)}
          height={dimensions.height}
          className="block"
        >
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {cascades.map((cascade, i) => {
              const barX = i * (barWidth + BAR_GAP);
              const isHovered = hoverIndex === i;
              const isCurrent = currentIndex === i;

              // Count effects by type
              let signalCount = 1; // Root signal
              let computedCount = 0;
              let effectCount = 0;

              for (const effect of cascade.effects) {
                const type = effect.event.eventType;
                if (type.includes('computed')) computedCount++;
                else if (type.includes('effect')) effectCount++;
                else if (type.includes('subscribe')) effectCount++;
              }

              const total = signalCount + computedCount + effectCount;
              const scale = (total / maxEffects) * innerHeight;

              const signalHeight = (signalCount / total) * scale;
              const computedHeight = (computedCount / total) * scale;
              const effectHeight = (effectCount / total) * scale;

              return (
                <g
                  key={cascade.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                  onClick={() => onCascadeClick(i)}
                >
                  {/* Invisible hit area */}
                  <rect
                    x={barX}
                    y={0}
                    width={barWidth}
                    height={innerHeight}
                    fill="transparent"
                  />

                  {/* Signal (bottom) */}
                  <rect
                    x={barX}
                    y={innerHeight - signalHeight}
                    width={barWidth}
                    height={signalHeight}
                    fill={NODE_COLORS.signal.border}
                    opacity={isHovered || isCurrent ? 1 : 0.6}
                    rx={2}
                    className="pointer-events-none"
                  />

                  {/* Computed (middle) */}
                  {computedHeight > 0 && (
                    <rect
                      x={barX}
                      y={innerHeight - signalHeight - computedHeight}
                      width={barWidth}
                      height={computedHeight}
                      fill={NODE_COLORS.computed.border}
                      opacity={isHovered || isCurrent ? 1 : 0.6}
                      className="pointer-events-none"
                    />
                  )}

                  {/* Effect (top) */}
                  {effectHeight > 0 && (
                    <rect
                      x={barX}
                      y={innerHeight - signalHeight - computedHeight - effectHeight}
                      width={barWidth}
                      height={effectHeight}
                      fill={NODE_COLORS.effect.border}
                      opacity={isHovered || isCurrent ? 1 : 0.6}
                      rx={2}
                      className="pointer-events-none"
                    />
                  )}

                  {/* Current selection indicator */}
                  {isCurrent && (
                    <rect
                      x={barX - 2}
                      y={innerHeight - scale - 2}
                      width={barWidth + 4}
                      height={scale + 4}
                      fill="none"
                      stroke="#fff"
                      strokeWidth={2}
                      rx={3}
                      className="pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Tooltip - positioned below the chart to avoid clipping */}
      {hoveredCascade && hoverIndex !== null && (
        <div
          className="absolute pointer-events-none bg-popover text-popover-foreground text-xs px-2 py-1.5 rounded shadow-lg border border-border/50 z-50 whitespace-nowrap"
          style={{
            left: Math.max(
              8,
              Math.min(
                hoverIndex * (barWidth + BAR_GAP) + MARGIN.left + barWidth / 2 - (scrollRef.current?.scrollLeft ?? 0),
                dimensions.width - 8
              )
            ),
            bottom: 4,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-mono text-muted-foreground">
            {formatTime(hoveredCascade.startTime)}
          </div>
          <div className="text-foreground">
            {hoveredCascade.rootNode?.name ?? 'signal'} → {hoveredCascade.effects.length} reaction{hoveredCascade.effects.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
