declare const __MCP_VERSION__: string | undefined

/** Injected by build.mjs in the bundle; tsc/vitest builds report 'dev'. */
export const VERSION = typeof __MCP_VERSION__ === 'string' ? __MCP_VERSION__ : 'dev'
