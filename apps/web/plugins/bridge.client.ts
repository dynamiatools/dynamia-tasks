// plugins/bridge.client.ts
// Runs only on the client side (browser/JCEF/webview).
// Auto-detects the IDE host and initialises the global `ide` proxy.

import { initBridge, detectBridge } from '@dynamia-tools/ide-bridge'
import { useIdeThemeStore } from '~/stores/ideTheme'

export default defineNuxtPlugin(async () => {
  initBridge(detectBridge())

  const ideTheme = useIdeThemeStore()
  await ideTheme.syncFromIde()
  ideTheme.startListening()
})

