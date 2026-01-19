import React from 'react';
import type { StratifiedNodeData } from '../stratifiedLayout';
import { useSemanticZoom } from '../hooks/useSemanticZoom';
import { OverviewNode } from './OverviewNode';
import { DetailNode } from './DetailNode';

/**
 * Stratified node component that switches between overview and detail
 * based on the current zoom level
 */
export function StratifiedNode({ data }: { data: StratifiedNodeData }): React.ReactElement {
  const zoomLevel = useSemanticZoom();

  if (zoomLevel === 'overview') {
    return <OverviewNode data={data} />;
  }

  return <DetailNode data={data} />;
}
