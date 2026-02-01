import { cssVars, MONOSPACE_FONT } from './theme';

/**
 * All sandbox styles as a CSS string.
 * Injected into the shadow root for style isolation.
 */
export const sandboxStyles = `
/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
}

/* Container */
.sandbox {
  border: 1px solid ${cssVars.hairline};
  border-radius: 8px;
  overflow: hidden;
  background: ${cssVars.bg};
  font-family: system-ui, -apple-system, sans-serif;
}

/* Editor Container */
.sandbox-editor-container {
  display: flex;
  flex-direction: column;
}

.sandbox-editor-container--hidden {
  display: none;
}

/* Output Container */
.sandbox-output-container--hidden {
  display: none;
}

/* Editor */
.sandbox-editor {
  position: relative;
  overflow: hidden;
}

.sandbox-editor--flex {
  flex: 1;
  min-height: 0;
}

/* Monaco Editor (iframe) */
.sandbox-editor--monaco {
  display: flex;
  flex-direction: column;
}

.sandbox-editor--monaco iframe {
  flex: 1;
  min-height: 0;
}


.sandbox-editor__overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: auto;
  pointer-events: none;
  padding: 12px;
  margin: 0;
  white-space: pre;
  background: ${cssVars.bgNav};
  color: ${cssVars.text};
  font-family: ${MONOSPACE_FONT};
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: 0;
  word-spacing: 0;
  tab-size: 2;
}

.sandbox-editor__overlay pre,
.sandbox-editor__overlay code {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  font-family: ${MONOSPACE_FONT};
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: 0;
  word-spacing: 0;
  tab-size: 2;
}

.sandbox-editor__textarea {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  padding: 12px;
  margin: 0;
  background: transparent;
  color: transparent;
  caret-color: ${cssVars.text};
  border: none;
  outline: none;
  resize: none;
  white-space: pre;
  overflow: auto;
  z-index: 1;
  font-family: ${MONOSPACE_FONT};
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: 0;
  word-spacing: 0;
  tab-size: 2;
}

/* File Tabs */
.sandbox-file-tabs {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  background: ${cssVars.bgSidebar};
  border-bottom: 1px solid ${cssVars.hairline};
  scrollbar-width: thin;
  flex-shrink: 0;
}

.sandbox-file-tab {
  padding: 8px 16px;
  font-family: ${MONOSPACE_FONT};
  font-size: 12px;
  font-weight: 400;
  color: ${cssVars.textAccent};
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  flex-shrink: 0;
}

.sandbox-file-tab:hover {
  color: ${cssVars.text};
  background: ${cssVars.bg};
}

.sandbox-file-tab--active {
  font-weight: 600;
  color: ${cssVars.text};
  background: ${cssVars.bgNav};
  border-bottom-color: ${cssVars.accent};
}

.sandbox-file-tab--active:hover {
  background: ${cssVars.bgNav};
}

/* Bottom Bar */
.sandbox-bottombar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: ${cssVars.bgSidebar};
  border-top: 1px solid ${cssVars.hairline};
}

.sandbox-toggle {
  display: flex;
}

.sandbox-toggle-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: ${cssVars.textAccent};
  background: transparent;
  border: 1px solid ${cssVars.hairline};
  cursor: pointer;
  transition: all 0.15s;
}

.sandbox-toggle-btn:first-child {
  border-radius: 4px 0 0 4px;
  border-right: none;
}

.sandbox-toggle-btn:last-child {
  border-radius: 0 4px 4px 0;
}

.sandbox-toggle-btn--active {
  color: white;
  background: ${cssVars.accent};
  border-color: ${cssVars.accent};
}

.sandbox-imports {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.sandbox-import-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: ${cssVars.textAccent};
  background: transparent;
  border: 1px solid ${cssVars.hairline};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.sandbox-import-btn:hover {
  color: ${cssVars.text};
  border-color: ${cssVars.accent};
}

/* Output */
.sandbox-output {
  padding: 12px;
  background: ${cssVars.bg};
  overflow: auto;
}

.sandbox-output__placeholder {
  color: ${cssVars.textAccent};
  font-size: 13px;
  font-style: italic;
}

/* Error Display */
.sandbox-error {
  background: rgba(231, 88, 57, 0.1);
  border: 1px solid ${cssVars.accent};
  border-radius: 4px;
  padding: 12px;
  font-family: ${MONOSPACE_FONT};
}

.sandbox-error__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: ${cssVars.accent};
  font-weight: 600;
  font-size: 14px;
}

.sandbox-error__message {
  color: ${cssVars.text};
  font-size: 13px;
  line-height: 1.5;
}

.sandbox-error__details {
  margin-top: 8px;
}

.sandbox-error__summary {
  color: ${cssVars.textAccent};
  font-size: 12px;
  cursor: pointer;
}

.sandbox-error__stack {
  margin: 8px 0 0 0;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.4;
  overflow-x: auto;
  color: ${cssVars.textAccent};
}

/* Controls */
.sandbox-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  background: ${cssVars.bgSidebar};
  border-top: 1px solid ${cssVars.hairline};
  flex-wrap: wrap;
}

.sandbox-controls__packages {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.sandbox-controls__label {
  font-size: 12px;
  font-weight: 600;
  color: ${cssVars.textAccent};
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sandbox-controls__checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
}

.sandbox-controls__checkbox input {
  cursor: pointer;
}

.sandbox-controls__spacer {
  flex: 1;
}

.sandbox-run-btn {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  background: ${cssVars.accent};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.sandbox-run-btn:hover {
  opacity: 0.9;
}
`;

/**
 * Create a style element with the sandbox styles
 */
export function createStyleElement(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = sandboxStyles;
  return style;
}
