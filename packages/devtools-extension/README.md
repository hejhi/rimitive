# @rimitive/devtools-extension

> **In Development** — Not yet published.

Chrome DevTools extension for debugging rimitive applications. Signal logging, dependency graphs, timeline view.

## Development

```bash
pnpm --filter @rimitive/devtools-extension dev          # Chrome
pnpm --filter @rimitive/devtools-extension dev:firefox  # Firefox
pnpm --filter @rimitive/devtools-extension build
```

**Load in Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`

**Load in Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `.output/firefox-mv2`

Built with [WXT](https://wxt.dev/) and React. Uses rimitive signals internally.
