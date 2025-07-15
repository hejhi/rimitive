import { Activity } from 'lucide-react';

export function ConnectionStatus() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-center space-y-4">
      <Activity className="w-12 h-12 text-muted-foreground animate-pulse" />
      <p className="text-lg text-muted-foreground">Waiting for Lattice...</p>
      <p className="text-sm text-muted-foreground">
        Make sure the page is using{' '}
        <code className="bg-muted px-1 py-0.5 rounded">
          @lattice/devtools
        </code>
      </p>
    </div>
  );
}