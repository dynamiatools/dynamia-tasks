/** Bumped every time the task files change on disk; pages `watch` it to refresh. */
export const useTasksVersion = () => useState<number>('tasksVersion', () => 0)
