import { Badge } from '../../src/components/ui/badge';
import { type DependencyNode } from './store/types';

interface NodeDependencyViewProps {
  node: DependencyNode;
  dependencies: Array<{ id: string; node?: DependencyNode }>;
  subscribers: Array<{ id: string; node?: DependencyNode }>;
}

export function NodeDependencyView({
  node,
  dependencies,
  subscribers,
}: NodeDependencyViewProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Badge
          variant={
            node.type === 'signal'
              ? 'default'
              : node.type === 'computed'
                ? 'secondary'
                : 'outline'
          }
        >
          {node.type}
        </Badge>
        <span className="font-mono text-sm">{node.name || node.id}</span>
        {node.isActive && (
          <Badge variant="outline" className="text-xs">
            active
          </Badge>
        )}
        {node.isOutdated && (
          <Badge variant="destructive" className="text-xs">
            outdated
          </Badge>
        )}
      </div>
      {node.value !== undefined && (
        <div className="text-xs text-muted-foreground font-mono">
          value: {JSON.stringify(node.value)}
        </div>
      )}
      {dependencies.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Dependencies:</span>
          <div className="ml-4 mt-1 space-y-1">
            {dependencies.map(({ id, node: dep }) => (
              <div key={id} className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {dep?.type || 'unknown'}
                </Badge>
                <span className="font-mono">{dep?.name || id}</span>
                {dep?.value !== undefined && (
                  <span className="text-muted-foreground">
                    = {JSON.stringify(dep.value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {subscribers.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Subscribers:</span>
          <div className="ml-4 mt-1 space-y-1">
            {subscribers.map(({ id, node: sub }) => (
              <div key={id} className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {sub?.type || 'unknown'}
                </Badge>
                <span className="font-mono">{sub?.name || id}</span>
                {sub?.value !== undefined && (
                  <span className="text-muted-foreground">
                    = {JSON.stringify(sub.value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
