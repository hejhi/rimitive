import { SourceMapConsumer, type RawSourceMap } from 'source-map-js';
import type { SourceLocation } from '../store/types';

// Cache for parsed source maps
const sourceMapCache = new Map<string, SourceMapConsumer | null>();

/**
 * Resolve a source location through source maps.
 *
 * Takes a location from a stack trace (which uses line numbers from the
 * transformed/bundled code) and returns the original source location.
 */
export async function resolveSourceLocation(
  location: SourceLocation
): Promise<SourceLocation> {
  const { filePath, line, column } = location;

  // Only process URLs (not file paths)
  if (!filePath.startsWith('http://') && !filePath.startsWith('https://')) {
    return location;
  }

  try {
    const consumer = await getSourceMapConsumer(filePath);
    if (!consumer) {
      return location;
    }

    // Look up the original position
    const originalPos = consumer.originalPositionFor({
      line,
      column: column ?? 0,
    });

    if (originalPos.line === null) {
      return location;
    }

    // Get the original source file name
    const originalSource = originalPos.source;
    const fileName = originalSource
      ? originalSource.split('/').pop()?.split('\\').pop() ?? location.display.split(':')[0]
      : location.display.split(':')[0];

    return {
      display: `${fileName}:${originalPos.line}`,
      filePath: location.filePath, // Keep original URL for openResource
      line: originalPos.line,
      column: originalPos.column ?? undefined,
    };
  } catch (err) {
    console.warn('[DevTools] Failed to resolve source map:', err);
    return location;
  }
}

/**
 * Fetch and parse a source map for a given URL.
 */
async function getSourceMapConsumer(
  url: string
): Promise<SourceMapConsumer | null> {
  // Check cache first
  if (sourceMapCache.has(url)) {
    return sourceMapCache.get(url) ?? null;
  }

  try {
    // Fetch the source file
    const response = await fetch(url);
    if (!response.ok) {
      sourceMapCache.set(url, null);
      return null;
    }

    const source = await response.text();

    // Look for inline source map
    const inlineMatch = source.match(
      /\/\/# sourceMappingURL=data:application\/json;base64,([^\s]+)/
    );

    if (inlineMatch) {
      const base64Data = inlineMatch[1];
      const jsonData = atob(base64Data);
      const sourceMap = JSON.parse(jsonData) as RawSourceMap;
      const consumer = new SourceMapConsumer(sourceMap);
      sourceMapCache.set(url, consumer);
      return consumer;
    }

    // Look for external source map URL
    const externalMatch = source.match(/\/\/# sourceMappingURL=([^\s]+)/);
    if (externalMatch) {
      const mapUrl = new URL(externalMatch[1], url).href;
      const mapResponse = await fetch(mapUrl);
      if (mapResponse.ok) {
        const sourceMap = (await mapResponse.json()) as RawSourceMap;
        const consumer = new SourceMapConsumer(sourceMap);
        sourceMapCache.set(url, consumer);
        return consumer;
      }
    }

    // No source map found
    sourceMapCache.set(url, null);
    return null;
  } catch (err) {
    console.warn('[DevTools] Error fetching source map:', err);
    sourceMapCache.set(url, null);
    return null;
  }
}

/**
 * Clear the source map cache (useful when reloading the inspected page).
 */
export function clearSourceMapCache(): void {
  sourceMapCache.clear();
}
