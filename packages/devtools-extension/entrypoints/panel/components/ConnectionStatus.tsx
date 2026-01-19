import { Activity, RefreshCw } from 'lucide-react';
import { useSubscribe } from '@rimitive/react';
import { useDevtools } from '../store/DevtoolsProvider';

export function ConnectionStatus() {
  const devtools = useDevtools();
  const status = useSubscribe(devtools.connectionStatus);
  const isReconnecting = status === 'reconnecting';

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-center space-y-4">
      {isReconnecting ? (
        <>
          <RefreshCw className="w-12 h-12 text-muted-foreground animate-spin" />
          <p className="text-lg text-muted-foreground">Reconnecting...</p>
        </>
      ) : (
        <>
          <Activity className="w-12 h-12 text-muted-foreground animate-pulse" />
          <p className="text-lg text-muted-foreground">Waiting for Rimitive...</p>
          <p className="text-sm text-muted-foreground">
            Make sure the page is using Rimitive with instrumentation enabled
          </p>
        </>
      )}
    </div>
  );
}
