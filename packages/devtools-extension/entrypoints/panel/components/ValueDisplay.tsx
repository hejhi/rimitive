import { useMemo } from 'react';
import { JSONTree } from 'react-json-tree';

type ValueDisplayProps = {
  value: string;
  mode: 'collapsed' | 'collapsed-no-preview' | 'expanded';
};

// Dark theme matching our UI
const theme = {
  scheme: 'custom',
  base00: 'transparent',
  base01: '#1a1a1a',
  base02: '#2a2a2a',
  base03: '#6b7280',
  base04: '#9ca3af',
  base05: '#e5e7eb',
  base06: '#f3f4f6',
  base07: '#ffffff',
  base08: '#f87171', // null, undefined
  base09: '#fb923c', // numbers
  base0A: '#fbbf24', // booleans
  base0B: '#4ade80', // strings
  base0C: '#22d3ee', // escape chars
  base0D: '#60a5fa', // keys
  base0E: '#c084fc', // keywords
  base0F: '#f472b6', // misc
};

type ParsedValue =
  | { type: 'single'; label: string | null; data: unknown }
  | { type: 'multi'; entries: Array<{ label: string; data: unknown }> }
  | null;

export function parseValue(value: string): ParsedValue {
  // Try multi-value format: "oldValue: [...], newValue: [...]"
  const multiMatch = value.match(
    /^(\w+):\s*(\[[\s\S]*?\]|\{[\s\S]*?\}),\s*(\w+):\s*(\[[\s\S]*?\]|\{[\s\S]*?\})$/
  );

  if (multiMatch) {
    const [, label1, json1, label2, json2] = multiMatch;
    try {
      return {
        type: 'multi',
        entries: [
          { label: label1, data: JSON.parse(json1) },
          { label: label2, data: JSON.parse(json2) },
        ],
      };
    } catch {
      // Fall through
    }
  }

  // Try "label: value" format
  const labelMatch = value.match(/^(\w+):\s*(.+)$/s);
  if (labelMatch) {
    const [, label, jsonPart] = labelMatch;
    try {
      return { type: 'single', label, data: JSON.parse(jsonPart) };
    } catch {
      return null;
    }
  }

  // Try raw JSON
  try {
    return { type: 'single', label: null, data: JSON.parse(value) };
  } catch {
    return null;
  }
}

export function isExpandableValue(value: string): boolean {
  const parsed = parseValue(value);
  if (!parsed) return false;
  if (parsed.type === 'multi') return true;
  return typeof parsed.data === 'object' && parsed.data !== null;
}

function getValueColor(value: unknown): string {
  if (value === null || value === undefined) return '#f87171';
  if (typeof value === 'number') return '#fb923c';
  if (typeof value === 'boolean') return '#fbbf24';
  if (typeof value === 'string') return '#4ade80';
  return '#e5e7eb';
}

export function ValueDisplay({ value, mode }: ValueDisplayProps) {
  const parsed = useMemo(() => parseValue(value), [value]);

  // Not parseable - just show raw text
  if (!parsed) {
    return <span className="text-foreground font-mono text-xs">{value}</span>;
  }

  // Expanded mode - show tree only
  if (mode === 'expanded') {
    if (parsed.type === 'multi') {
      return (
        <div className="font-mono text-xs space-y-3">
          {parsed.entries.map((entry, i) => (
            <div key={i}>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
                {entry.label}
              </div>
              <JSONTree
                data={entry.data}
                theme={theme}
                invertTheme={false}
                hideRoot
                shouldExpandNodeInitially={(_keyPath, _data, level) => level < 2}
              />
            </div>
          ))}
        </div>
      );
    }

    const { data } = parsed;
    return (
      <div className="font-mono text-xs">
        <JSONTree
          data={data}
          theme={theme}
          invertTheme={false}
          hideRoot
          shouldExpandNodeInitially={(_keyPath, _data, level) => level < 2}
        />
      </div>
    );
  }

  // Collapsed modes - inline display
  if (parsed.type === 'multi') {
    return (
      <span className="font-mono text-xs text-foreground/70">
        {parsed.entries.map((e) => e.label).join(' → ')}
      </span>
    );
  }

  const { label, data } = parsed;
  const isComplex = typeof data === 'object' && data !== null;

  // Simple values - always show inline
  if (!isComplex) {
    return (
      <span className="font-mono text-xs">
        {label && <span className="text-muted-foreground">{label}: </span>}
        <span style={{ color: getValueColor(data) }}>{JSON.stringify(data)}</span>
      </span>
    );
  }

  // Complex values - type label + optional preview
  const preview = JSON.stringify(data);
  const typeLabel = Array.isArray(data) ? `Array(${(data as unknown[]).length})` : 'Object';

  return (
    <span className="font-mono text-xs">
      {label && <span className="text-muted-foreground">{label}: </span>}
      <span className="text-foreground/70">{typeLabel}</span>
      {mode === 'collapsed' && (
        <span className="text-muted-foreground/60"> {preview}</span>
      )}
    </span>
  );
}
