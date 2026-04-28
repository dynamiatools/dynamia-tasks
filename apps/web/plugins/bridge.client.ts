// plugins/bridge.client.ts
// Runs only on the client side (browser/JCEF/webview).
// Auto-detects the IDE host and initialises the global `ide` proxy.

import { initBridge, detectBridge } from '@dynamia-tools/ide-bridge'

export default defineNuxtPlugin(() => {
  initBridge(detectBridge())
})

