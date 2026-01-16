import { useSubscribe } from '@rimitive/react';
import { Input } from '../../../src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/components/ui/select';
import type { ContextInfo } from '../store/types';
import { availableEventTypes } from '../store/eventTypeManager';

type FilterBarProps = {
  contexts: ContextInfo[];
  selectedContext: string | null;
  filterType: string;
  searchValue: string;
  onContextChange: (value: string | null) => void;
  onFilterTypeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

export function FilterBar({
  contexts,
  selectedContext,
  filterType,
  searchValue,
  onContextChange,
  onFilterTypeChange,
  onSearchChange,
}: FilterBarProps) {
  const eventTypes = useSubscribe(availableEventTypes);

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
    </div>
  );
}
