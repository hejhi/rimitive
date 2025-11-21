export interface InstrumentationEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  contextId?: string;
}

export interface InstrumentationProvider {
  name: string;
  init(contextId: string, contextName: string): void;
  emit(event: InstrumentationEvent): void;
  register<T>(
    resource: T,
    type: string,
    name?: string
  ): { id: string; resource: T };
  dispose?(): void;
}

export interface InstrumentationConfig {
  providers: InstrumentationProvider[];
  enabled?: boolean | (() => boolean);
}
