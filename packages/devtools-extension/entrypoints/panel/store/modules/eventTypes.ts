// Event data types for Lattice events

export interface SignalCreatedEventData {
  id: string;
  name?: string;
  initialValue: unknown;
}

export interface SignalWriteEventData {
  id: string;
  name?: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ComputedCreatedEventData {
  id: string;
  name?: string;
}

export interface EffectCreatedEventData {
  id: string;
  name?: string;
}

export interface SelectorCreatedEventData {
  id: string;
  sourceId: string;
  sourceName?: string;
  sourceType: 'signal' | 'computed';
  selector: string;
}

export interface NamedItemData {
  id: string;
  name?: string;
}

export interface ComputedEndEventData {
  id: string;
  name?: string;
  duration?: number;
  value?: unknown;
}

export interface EffectEndEventData {
  id: string;
  name?: string;
  duration?: number;
}