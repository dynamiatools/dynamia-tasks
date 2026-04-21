// composables/useApi.ts
export const useApi = () => {
  const BASE = useRuntimeConfig().public.apiBase

  return {
    get: <T>(path: string) => $fetch<T>(`${BASE}${path}`),
    post: <T>(path: string, body: unknown) =>
      $fetch<T>(`${BASE}${path}`, { method: 'POST', body }),
    patch: <T>(path: string, body: unknown) =>
      $fetch<T>(`${BASE}${path}`, { method: 'PATCH', body }),
    delete: <T>(path: string) =>
      $fetch<T>(`${BASE}${path}`, { method: 'DELETE' }),
    put: <T>(path: string, body: unknown) =>
      $fetch<T>(`${BASE}${path}`, { method: 'PUT', body }),
  }
}

