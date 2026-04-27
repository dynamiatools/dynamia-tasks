/**
 * Redirects /index.html (with any query params) to / so the VS Code webview
 * doesn't hit "Page not found" on first load.
 *
 * VS Code opens webview panels with a URL like:
 *   /index.html?id=...&parentId=...&origin=...
 * which the Nuxt SPA router can't match to any page.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/index.html') {
    return navigateTo('/', { replace: true })
  }
})

