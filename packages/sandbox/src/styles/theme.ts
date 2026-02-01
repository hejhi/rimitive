/**
 * CSS variable values with fallbacks for Starlight integration
 */
export const cssVars = {
  bg: 'var(--sl-color-bg, #1e1e1e)',
  bgNav: 'var(--sl-color-bg-nav, #1e1e1e)',
  bgSidebar: 'var(--sl-color-bg-sidebar, #252526)',
  hairline: 'var(--sl-color-hairline, #3c3c3c)',
  text: 'var(--sl-color-text, #d4d4d4)',
  textAccent: 'var(--sl-color-text-accent, #888)',
  accent: 'var(--sl-color-accent, #E75839)',
} as const;

/**
 * Monospace font stack for code display
 */
export const MONOSPACE_FONT =
  "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace";
