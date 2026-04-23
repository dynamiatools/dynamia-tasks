// composables/useApi.ts
export const useApi = () => {
  const configured = useRuntimeConfig().public.apiBase as string
  // When the SPA is served by the Dynamia Tasks server itself (production / IDE
  // embedded webview) apiBase is left empty so requests go to the same origin,
  // which is always correct regardless of which port the server picked.
  // In standalone dev mode set NUXT_PUBLIC_API_BASE=http://localhost:7842.
  const BASE = configured || (import.meta.client ? window.location.origin : '')

  return {
    baseUrl: BASE,
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
