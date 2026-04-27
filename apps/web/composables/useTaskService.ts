/**
 * composables/useTaskService.ts
 *
 * Re-exports the global taskService singleton as a Nuxt auto-importable composable.
 * Stores and pages call useTaskService() instead of useApi().
 */
import { taskService } from '@dynamia-tasks/core'

export const useTaskService = () => taskService

