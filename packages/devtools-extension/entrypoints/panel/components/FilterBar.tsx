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
import { useDevtools } from '../store/DevtoolsProvider';

type FilterBarProps = {
  filterType: string;
  searchValue: string;
  filteredNodeId: string | null;
  onFilterTypeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClearNodeFilter: () => void;
};

export function FilterBar({
  filterType,
  searchValue,
  filteredNodeId,
  onFilterTypeChange,
  onSearchChange,
  onClearNodeFilter,
}: FilterBarProps) {
  const devtools = useDevtools();
  const eventTypes = useSubscribe(devtools.availableEventTypes);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filteredNodeId && (
        <Badge
          variant="secondary"
          className="h-8 px-2 flex items-center gap-1 text-xs font-mono"
        >
          <span className="max-w-30 truncate" title={filteredNodeId}>
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

      <Select value={filterType} onValueChange={onFilterTypeChange}>
        <SelectTrigger className="h-8 w-35 text-xs">
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
        className="w-50 h-8 text-xs"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}
