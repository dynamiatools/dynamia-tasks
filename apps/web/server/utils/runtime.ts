/**
 * Returns the configured projectPath from env/runtimeConfig.
 * Used by workspace routes that need access to the project directory.
 */
export function getProjectPath(): string {
  return (
    process.env.NUXT_PROJECT_PATH ||
    process.env.DYNAMIA_PROJECT_PATH ||
    (useRuntimeConfig().projectPath as string) ||
    process.cwd()
  )
}

/**
 * Returns the IDE callback URL from env/runtimeConfig.
 */
export function getIdeCallbackUrl(): string {
  return (
    process.env.NUXT_IDE_CALLBACK_URL ||
    (useRuntimeConfig().ideCallbackUrl as string) ||
    ''
  )
}

