import { useSubscribe } from '@rimitive/react';
import { X } from 'lucide-react';
import { Input } from '../../../src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/components/ui/select';
import { Badge } from '../../../src/components/ui/badge';
import type { ContextInfo } from '../store/types';
import { availableEventTypes } from '../store/eventTypeManager';

type FilterBarProps = {
  contexts: ContextInfo[];
  selectedContext: string | null;
  filterType: string;
  searchValue: string;
  filteredNodeId: string | null;
  hideInternal: boolean;
  onContextChange: (value: string | null) => void;
  onFilterTypeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClearNodeFilter: () => void;
  onHideInternalChange: (value: boolean) => void;
};

export function FilterBar({
  contexts,
  selectedContext,
  filterType,
  searchValue,
  filteredNodeId,
  hideInternal,
  onContextChange,
  onFilterTypeChange,
  onSearchChange,
  onClearNodeFilter,
  onHideInternalChange,
}: FilterBarProps) {
  const eventTypes = useSubscribe(availableEventTypes);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filteredNodeId && (
        <Badge
          variant="secondary"
          className="h-8 px-2 flex items-center gap-1 text-xs font-mono"
        >
          <span className="max-w-[120px] truncate" title={filteredNodeId}>
            {filteredNodeId.slice(0, 8)}...
          </span>
          <button
            onClick={onClearNodeFilter}
            className="ml-1 hover:bg-muted rounded p-0.5"
            title="Clear filter"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {contexts.length > 1 && (
        <Select
          value={selectedContext || 'all'}
          onValueChange={(value) =>
            onContextChange(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Select service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {contexts.map((ctx) => (
              <SelectItem key={ctx.id} value={ctx.id}>
                {ctx.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={filterType} onValueChange={onFilterTypeChange}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {eventTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="text"
        placeholder="Search..."
        className="w-[200px] h-8 text-xs"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hideInternal}
          onChange={(e) => onHideInternalChange(e.target.checked)}
          className="rounded border-muted"
        />
        Hide internal
      </label>
    </div>
  );
}
