import type { FileEntry } from '../types';

/**
 * Diagnostic from Monaco/TypeScript
 */
export type Diagnostic = {
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

/**
 * Messages from parent to Monaco iframe
 */
export type ParentToMonaco =
  | { type: 'INIT'; files: FileEntry[]; activeFile: string }
  | { type: 'SET_FILE'; name: string; code: string }
  | { type: 'SWITCH_FILE'; name: string }
  | { type: 'FOCUS' };

/**
 * Messages from Monaco iframe to parent
 */
export type MonacoToParent =
  | { type: 'READY' }
  | { type: 'CODE_CHANGE'; fileName: string; code: string }
  | { type: 'DIAGNOSTICS'; fileName: string; diagnostics: Diagnostic[] };

/**
 * Bridge class for communicating with Monaco iframe
 */
export class MonacoIframeBridge {
  private iframe: HTMLIFrameElement;
  private ready = false;
  private messageQueue: ParentToMonaco[] = [];
  private handlers: {
    onCodeChange?: (fileName: string, code: string) => void;
    onDiagnostics?: (fileName: string, diagnostics: Diagnostic[]) => void;
    onReady?: () => void;
  } = {};
  private messageListener: (event: MessageEvent) => void;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.messageListener = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageListener);
  }

  private handleMessage(event: MessageEvent): void {
    // Verify message is from our iframe
    if (event.source !== this.iframe.contentWindow) {
      return;
    }

    const message = event.data as MonacoToParent;

    switch (message.type) {
      case 'READY':
        this.ready = true;
        // Flush queued messages
        for (const queued of this.messageQueue) {
          this.postMessage(queued);
        }
        this.messageQueue = [];
        this.handlers.onReady?.();
        break;

      case 'CODE_CHANGE':
        this.handlers.onCodeChange?.(message.fileName, message.code);
        break;

      case 'DIAGNOSTICS':
        this.handlers.onDiagnostics?.(message.fileName, message.diagnostics);
        break;
    }
  }

  private postMessage(message: ParentToMonaco): void {
    this.iframe.contentWindow?.postMessage(message, '*');
  }

  /**
   * Send a message to the iframe, queuing if not ready
   */
  send(message: ParentToMonaco): void {
    if (this.ready) {
      this.postMessage(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * Set handler for code changes
   */
  onCodeChange(handler: (fileName: string, code: string) => void): void {
    this.handlers.onCodeChange = handler;
  }

  /**
   * Set handler for diagnostics
   */
  onDiagnostics(
    handler: (fileName: string, diagnostics: Diagnostic[]) => void
  ): void {
    this.handlers.onDiagnostics = handler;
  }

  /**
   * Set handler for ready event
   */
  onReady(handler: () => void): void {
    this.handlers.onReady = handler;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    window.removeEventListener('message', this.messageListener);
    this.handlers = {};
    this.messageQueue = [];
  }
}
