/**
 * Source location info with both display name and full path for editor jumping.
 */
export type SourceLocation = {
  /** Short display name like "TodoList.ts:23" */
  display: string;
  /** Full file path for editor jumping */
  filePath: string;
  /** Line number */
  line: number;
  /** Column number (if available) */
  column?: number;
};

/**
 * Parse a stack trace to extract the caller's source location.
 *
 * Returns a short, readable location like "TodoList.ts:23" or "service.ts:15".
 * Skips internal frames (node_modules, rimitive internals) to find the user's code.
 */
export function getCallerLocation(skipFrames = 0): string | undefined {
  const location = getCallerLocationFull(skipFrames + 1);
  return location?.display;
}

/**
 * Parse a stack trace to extract full source location info.
 *
 * Returns both a short display name and the full file path for editor integration.
 * Skips internal frames (node_modules, rimitive internals) to find the user's code.
 */
export function getCallerLocationFull(skipFrames = 0): SourceLocation | undefined {
  const stack = new Error().stack;
  if (!stack) return undefined;

  const lines = stack.split('\n');

  // Skip: "Error", this function, and any additional frames requested
  const startIndex = 2 + skipFrames;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Skip internal frames
    if (
      line.includes('node_modules') ||
      line.includes('@rimitive/') ||
      line.includes('rimitive/packages/')
    ) {
      continue;
    }

    // Parse the location from the stack frame
    const location = parseStackFrameFull(line);
    if (location) {
      return location;
    }
  }

  return undefined;
}

/**
 * Parse a single stack frame line to extract full location info.
 *
 * Handles various formats:
 * - Chrome/V8: "    at functionName (file.ts:10:5)"
 * - Chrome/V8 anonymous: "    at file.ts:10:5"
 * - Firefox: "functionName@file.ts:10:5"
 * - Safari: "functionName@file.ts:10:15"
 */
function parseStackFrameFull(frame: string): SourceLocation | undefined {
  // Try Chrome/V8 format: "at ... (file:line:col)" or "at file:line:col"
  const chromeMatch = frame.match(/at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?$/);
  if (chromeMatch) {
    return formatLocationFull(chromeMatch[1], chromeMatch[2], chromeMatch[3]);
  }

  // Try Firefox/Safari format: "name@file:line:col"
  const firefoxMatch = frame.match(/@(.+?):(\d+):(\d+)$/);
  if (firefoxMatch) {
    return formatLocationFull(firefoxMatch[1], firefoxMatch[2], firefoxMatch[3]);
  }

  return undefined;
}

/**
 * Format a file path and line number into a SourceLocation.
 */
function formatLocationFull(
  filePath: string | undefined,
  line: string | undefined,
  column?: string
): SourceLocation | undefined {
  if (!filePath || !line) return undefined;

  // Extract just the filename from the path
  const fileName = filePath.split('/').pop()?.split('\\').pop();
  if (!fileName) return undefined;

  // Remove query strings (Vite adds these) for display
  const cleanName = fileName.split('?')[0] ?? fileName;
  // Also clean the full path
  const cleanPath = filePath.split('?')[0] ?? filePath;

  const lineNum = parseInt(line, 10);

  return {
    display: `${cleanName}:${line}`,
    filePath: cleanPath,
    line: lineNum,
    column: column ? parseInt(column, 10) : undefined,
  };
}
