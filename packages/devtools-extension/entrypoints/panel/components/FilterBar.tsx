import { Input } from '../../../src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/components/ui/select';
import type { ContextInfo } from '../store/types';

interface FilterBarProps {
  contexts: ContextInfo[];
  selectedContext: string | null;
  filterType: 'all' | 'signal' | 'computed' | 'effect' | 'selector';
  searchValue: string;
  onContextChange: (value: string | null) => void;
  onFilterTypeChange: (value: 'all' | 'signal' | 'computed' | 'effect' | 'selector') => void;
  onSearchChange: (value: string) => void;
}

export function FilterBar({
  contexts,
  selectedContext,
  filterType,
  searchValue,
  onContextChange,
  onFilterTypeChange,
  onSearchChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {contexts.length > 1 && (
        <Select
          value={selectedContext || 'all'}
          onValueChange={(value) =>
            onContextChange(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Select context" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contexts</SelectItem>
            {contexts.map((ctx) => (
              <SelectItem key={ctx.id} value={ctx.id}>
                {ctx.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={filterType}
        onValueChange={(value) =>
          onFilterTypeChange(value as 'all' | 'signal' | 'computed' | 'effect' | 'selector')
        }
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="signal">Signals</SelectItem>
          <SelectItem value="computed">Computed</SelectItem>
          <SelectItem value="effect">Effects</SelectItem>
          <SelectItem value="selector">Selectors</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="text"
        placeholder="Search..."
        className="w-[200px] h-8 text-xs"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}
