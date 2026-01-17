import { useViewport } from '@xyflow/react';

export type ZoomLevel = 'overview' | 'detail';

const ZOOM_THRESHOLD = 0.5;

/**
 * Hook to determine current semantic zoom level
 * Returns 'overview' when zoomed out, 'detail' when zoomed in
 */
export function useSemanticZoom(): ZoomLevel {
  const { zoom } = useViewport();
  return zoom < ZOOM_THRESHOLD ? 'overview' : 'detail';
}
