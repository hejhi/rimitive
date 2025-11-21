# View Devtools Instrumentation

This directory contains instrumentation wrappers for view extensions (`el`, `map`, `on`) that enable debugging and profiling capabilities.

## Overview

The instrumentation follows the same pattern as signals instrumentation:

- Each extension has a corresponding `instrument*` function
- The function wraps the base impl to emit events at key lifecycle points
- Events are emitted through the `InstrumentationContext`

## Available Instrumentation

### `instrumentEl`

Tracks element creation, mounting, and unmounting for both static and reactive elements.

**Events emitted:**

- `EL_STATIC_CREATED` - Static element blueprint created
- `EL_CHILDREN_APPLIED` - Children applied to static element
- `EL_STATIC_MOUNTED` - Static element mounted to DOM
- `EL_STATIC_READY` - Static element lifecycle callbacks executed
- `EL_REACTIVE_CREATED` - Reactive element created
- `EL_REACTIVE_MOUNTED` - Reactive element mounted to DOM
- `EL_REACTIVE_UNMOUNTED` - Reactive element unmounted from DOM

### `instrumentMap`

Tracks list reconciliation operations and item lifecycle.

**Events emitted:**

- `MAP_CREATED` - Map helper created
- `MAP_RENDER_ATTACHED` - Render function attached to map
- `MAP_ITEM_RENDER` - Individual item rendered
- `MAP_MOUNTED` - Map fragment mounted to DOM
- `MAP_UNMOUNTED` - Map fragment unmounted from DOM

### `instrumentOn`

Tracks event listener attachment, event fires, and detachment.

**Events emitted:**

- `ON_CREATED` - Event listener configuration created
- `ON_ATTACHED` - Event listener attached to element
- `ON_EVENT_FIRED` - Event fired and handler called
- `ON_DETACHED` - Event listener detached from element

## Usage

To use instrumentation, pass the `instrument` function when creating the extension:

```typescript
import { El } from '@lattice/view';
import { instrumentEl } from '@lattice/view/devtools';

// Create instrumentation context
const instrumentation = createInstrumentation({
  enabled: true,
  providers: [myInstrumentationProvider],
});

// Create instrumented extension
const el = El().create({
  // ... other options
  instrument: instrumentEl,
}).impl;
```

## Example: Full View Context with Instrumentation

```typescript
import { compose } from '@lattice/lattice';
import { El } from '@lattice/view';
import { Map } from '@lattice/view/map';
import { On } from '@lattice/view/on';
import {
  instrumentEl,
  instrumentMap,
  instrumentOn,
} from '@lattice/view/devtools';

// Create instrumentation context
const instrumentation = createInstrumentation({
  enabled: true,
  providers: [consoleProvider],
});

// Create view extensions with instrumentation
const viewApi = {
  el: El().create({
    /* ctx, renderer, etc. */
    instrument: instrumentEl,
  }).impl,

  map: Map().create({
    /* ctx, signal, etc. */
    instrument: instrumentMap,
  }).impl,

  on: On().create({
    /* startBatch, endBatch */
    instrument: instrumentOn,
  }).impl,
};

// Use with instrumentation enabled
const { el, map, on } = viewApi;
```

## Event Data Structure

All events follow this structure:

```typescript
interface InstrumentationEvent {
  type: string; // Event type (e.g., 'EL_STATIC_CREATED')
  timestamp: number; // Event timestamp
  data: {
    [key: string]: unknown; // Event-specific data
  };
}
```

## Integration with Signal Instrumentation

View instrumentation works alongside signal instrumentation. When both are enabled, you can track:

- Signal reads/writes triggering element updates
- Event handlers updating signals
- Map reconciliation triggered by signal changes
- Complete reactive data flow through your application
