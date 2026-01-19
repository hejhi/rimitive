# @rimitive/devtools-extension

Chrome DevTools extension for debugging rimitive applications. Inspect signals, track updates, view dependency graphs.

## Install

Download the latest release from [GitHub Releases](https://github.com/hejhi/rimitive/releases?q=devtools-extension&expanded=true), then:

**Chrome / Edge / Brave / Arc:**

1. Unzip the downloaded file
2. Go to `chrome://extensions` (or `edge://extensions`, etc.)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the unzipped folder

**Firefox:**

1. Unzip the downloaded file
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select any file in the unzipped folder

## Usage

1. Open DevTools (F12 or Cmd+Option+I)
2. Find the "Rimitive" panel tab
3. Your app must use instrumentation:

```typescript
import {
  compose,
  createInstrumentation,
  devtoolsProvider,
} from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';

const svc = compose(SignalModule, ComputedModule, EffectModule, {
  instrumentation: createInstrumentation({
    providers: [devtoolsProvider()],
  }),
});
```

## Development

```bash
pnpm --filter @rimitive/devtools-extension dev          # Chrome (hot reload)
pnpm --filter @rimitive/devtools-extension dev:firefox  # Firefox (hot reload)
pnpm --filter @rimitive/devtools-extension build        # Production build
pnpm --filter @rimitive/devtools-extension zip          # Create distributable
```

### Loading the built extension locally

After running `build`, load the extension from `packages/devtools-extension/dist/chrome-mv3/`:

1. Go to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select `packages/devtools-extension/dist/chrome-mv3/`

Test with the example app:

```bash
pnpm --filter @rimitive/example-devtools dev
```

Built with [WXT](https://wxt.dev/) and React.
