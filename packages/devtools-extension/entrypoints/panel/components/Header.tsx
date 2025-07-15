import { Code2, MoreVertical, Download, Upload } from 'lucide-react';
import { Badge } from '../../../src/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../src/components/ui/dropdown-menu';

interface HeaderProps {
  contextCount: number;
  stats: {
    totalSignals: number;
    totalComputeds: number;
    totalEffects: number;
  };
  onExport: () => void;
  onImport: () => void;
}

export function Header({ contextCount, stats, onExport, onImport }: HeaderProps) {
  return (
    <header className="border-b flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <Code2 className="w-5 h-5" />
        <h1 className="font-semibold">Lattice DevTools</h1>
        <Badge variant="secondary" className="text-xs">
          {contextCount} context{contextCount !== 1 ? 's' : ''}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{stats.totalSignals} signals</span>
          <span>•</span>
          <span>{stats.totalComputeds} computed</span>
          <span>•</span>
          <span>{stats.totalEffects} effects</span>
        </div>
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