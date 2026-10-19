<script setup lang="ts">
import { ide } from '@dynamia-tools/ide-bridge'

const { file, installed, node, server, claudeCommand, jsonConfig, check, copy } = useMcpStatus()
const tab = ref<'claude' | 'vscode' | 'intellij'>('claude')
const tabs = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'intellij', label: 'IntelliJ' },
] as const

const rows = computed(() => [
  { label: 'Server file', check: installed.value },
  { label: 'Node.js', check: node.value },
  { label: 'Server starts', check: server.value },
])

onMounted(() => {
  // Default to the guide for the host we are running in.
  try { if (ide.env.getPlatform() === 'intellij') tab.value = 'intellij' } catch { /* keep default */ }
  check()
})
</script>

<template>
  <section>
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-semibold text-dt-muted uppercase tracking-widest">MCP for agents</p>
      <button
        type="button"
        class="text-xs px-2 py-1 rounded border border-dt-border text-dt-muted hover:border-dt-accent hover:text-white transition-colors"
        @click="check()"
      >Verify</button>
    </div>
    <p class="text-xs text-dt-dim mb-3">
      Lets an agent list, create, update and comment on this project's local tasks
      (<code>mcp__dynamia-tasks__*</code>) and add a GitHub issue to the workspace.
    </p>

    <ul class="divide-y divide-dt-border border-t border-dt-border mb-4">
      <li v-for="r in rows" :key="r.label" class="flex items-start gap-3 py-2">
        <span
          class="text-[11px] px-2 py-0.5 rounded border font-medium shrink-0"
          :class="{
            'text-dt-accent border-dt-accent/40 bg-dt-accent-deep/30': r.check.state === 'ok',
            'text-dt-warning border-dt-warning/40 bg-dt-warning/10': r.check.state === 'fail',
            'text-dt-dim border-dt-border': r.check.state === 'idle' || r.check.state === 'checking',
          }"
        >{{ r.check.state === 'ok' ? 'OK' : r.check.state === 'fail' ? 'Problem' : '…' }}</span>
        <div class="min-w-0">
          <p class="text-sm text-dt-text">{{ r.label }}</p>
          <p v-if="r.check.detail" class="text-xs text-dt-dim break-all">{{ r.check.detail }}</p>
        </div>
      </li>
    </ul>

    <div class="flex gap-2 mb-3">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="px-3 py-1 text-xs rounded border transition-colors"
        :class="tab === t.id ? 'border-dt-accent text-white' : 'border-dt-border text-dt-muted hover:border-dt-accent'"
        @click="tab = t.id"
      >{{ t.label }}</button>
    </div>

    <div v-if="tab === 'claude'" class="space-y-2 text-xs text-dt-muted">
      <p>Run this once in a terminal, from your project:</p>
      <pre class="p-2 rounded border border-dt-border text-dt-text whitespace-pre-wrap break-all">{{ claudeCommand }}</pre>
      <button type="button" class="px-2 py-1 rounded border border-dt-border hover:border-dt-accent hover:text-white" @click="copy(claudeCommand, 'Command')">Copy command</button>
    </div>

    <div v-else-if="tab === 'vscode'" class="space-y-2 text-xs text-dt-muted">
      <p>VS Code 1.101 or newer registers the server by itself: open the MCP list (<em>Command Palette → MCP: List Servers</em>) and start <strong>Dynamia Tasks</strong>.</p>
      <p>On older versions, or to use it from Claude Code inside VS Code, use the Claude Code tab.</p>
    </div>

    <div v-else class="space-y-2 text-xs text-dt-muted">
      <p>IntelliJ does not register MCP servers from a plugin, so add it once by hand:</p>
      <ol class="list-decimal pl-5 space-y-1">
        <li>Make sure the checks above are OK (needs Node.js 20+ visible to the IDE; if you started the IDE from the dock or a launcher, start it from a terminal once so it sees your PATH).</li>
        <li>Open <em>Settings → Tools → AI Assistant → Model Context Protocol (MCP)</em> (or the MCP settings of Junie) and add a server, pasting this JSON. Menu names change between IDE versions.</li>
        <li>Save and check that the server shows as running. Its tools appear as <code>dynamia-tasks</code>.</li>
      </ol>
      <pre class="p-2 rounded border border-dt-border text-dt-text whitespace-pre-wrap break-all">{{ jsonConfig }}</pre>
      <div class="flex gap-2">
        <button type="button" class="px-2 py-1 rounded border border-dt-border hover:border-dt-accent hover:text-white" @click="copy(jsonConfig, 'JSON')">Copy JSON</button>
        <button type="button" class="px-2 py-1 rounded border border-dt-border hover:border-dt-accent hover:text-white" @click="copy(claudeCommand, 'Command')">Copy Claude Code command</button>
      </div>
      <p>The server file lives at <code class="break-all">{{ file }}</code> and is refreshed each time the plugin starts.</p>
    </div>
  </section>
</template>
