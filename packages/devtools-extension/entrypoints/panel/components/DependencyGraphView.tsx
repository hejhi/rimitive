import { Badge } from '../../../src/components/ui/badge';
import type { DependencyNode } from '../store/types';

interface DependencyGraphViewProps {
  nodes: DependencyNode[];
  getDependencies: (nodeId: string) => {
    dependencies: Array<{ id: string; node: DependencyNode | undefined }>;
    subscribers: Array<{ id: string; node: DependencyNode | undefined }>;
  };
}

export function DependencyGraphView({
  nodes,
  getDependencies,
}: DependencyGraphViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No dependency data available yet...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        {nodes.map((node) => (
          <DependencyNodeCard
            key={node.id}
            node={node}
            dependencies={getDependencies(node.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface DependencyNodeCardProps {
  node: DependencyNode;
  dependencies: {
    dependencies: Array<{ id: string; node: DependencyNode | undefined }>;
    subscribers: Array<{ id: string; node: DependencyNode | undefined }>;
  };
}

function DependencyNodeCard({ node, dependencies }: DependencyNodeCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Badge
          variant={
            node.type === 'signal'
              ? 'default'
              : node.type === 'computed'
                ? 'secondary'
                : node.type === 'selector'
                  ? 'destructive'
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

      {dependencies.dependencies.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Dependencies:</span>
          <div className="ml-4 mt-1 space-y-1">
            {dependencies.dependencies.map(({ id, node: dep }) => (
              <div key={id} className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {dep?.type || 'unknown'}
                </Badge>
                <span className="font-mono">{dep?.name || id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dependencies.subscribers.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Subscribers:</span>
          <div className="ml-4 mt-1 space-y-1">
            {dependencies.subscribers.map(({ id, node: sub }) => (
              <div key={id} className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {sub?.type || 'unknown'}
                </Badge>
                <span className="font-mono">{sub?.name || id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
