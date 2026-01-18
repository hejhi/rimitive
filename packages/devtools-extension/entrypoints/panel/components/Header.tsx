import { MoreVertical, Download, Upload } from 'lucide-react';
import { useSubscribe } from '@rimitive/react';
import { Badge } from '../../../src/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../src/components/ui/dropdown-menu';
import { devtoolsState } from '../store/devtoolsCtx';

type HeaderProps = {
  contextCount: number;
  onExport: () => void;
  onImport: () => void;
};

export function Header({ contextCount, onExport, onImport }: HeaderProps) {
  const filter = useSubscribe(devtoolsState.filter);

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
        <Badge variant="secondary" className="text-xs">
          {contextCount} service{contextCount !== 1 ? 's' : ''}
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={filter.hideInternal}
            onChange={(e) =>
              devtoolsState.filter({ ...filter, hideInternal: e.target.checked })
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
