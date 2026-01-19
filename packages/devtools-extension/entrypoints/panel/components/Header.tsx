import { MoreVertical, Download, Upload } from 'lucide-react';
import { useSubscribe } from '@rimitive/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../src/components/ui/dropdown-menu';
import { useDevtools } from '../store/DevtoolsProvider';
import type { ContextInfo } from '../store/types';

type HeaderProps = {
  contexts: ContextInfo[];
  selectedContext: string | null;
  onContextChange: (value: string | null) => void;
  onExport: () => void;
  onImport: () => void;
};

export function Header({
  contexts,
  selectedContext,
  onContextChange,
  onExport,
  onImport,
}: HeaderProps) {
  const devtools = useDevtools();
  const filter = useSubscribe(devtools.filter);

  // Get the display name for the current selection
  const selectedName = selectedContext
    ? (contexts.find((c) => c.id === selectedContext)?.name ?? 'Unknown')
    : `All (${contexts.length})`;

  return (
    <header className="border-b flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <img
          src="/logo-dark.svg"
          alt="Rimitive"
          className="h-3.5 dark:block hidden"
        />
        <img src="/logo.svg" alt="Rimitive" className="h-3.5 dark:hidden" />
        <h1 className="font-semibold">Rimitive DevTools</h1>
        <Select
          value={selectedContext || 'all'}
          onValueChange={(value) =>
            onContextChange(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="h-7 w-auto min-w-25 text-xs gap-1.5">
            <SelectValue>{selectedName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({contexts.length})</SelectItem>
            {contexts.map((ctx) => (
              <SelectItem key={ctx.id} value={ctx.id}>
                {ctx.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={filter.hideInternal}
            onChange={(e) =>
              devtools.filter({
                ...filter,
                hideInternal: e.target.checked,
              })
            }
            className="rounded border-muted-foreground/50 w-3 h-3"
          />
          Hide internal
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1 hover:bg-accent rounded">
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Data Management</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExport}>
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImport}>
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
