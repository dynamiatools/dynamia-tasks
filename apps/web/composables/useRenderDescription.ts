/**
 * Detects if content is HTML and prepares it for safe rendering.
 * For <img> tags, wraps them in an anchor to open the image in a new tab.
 * GitHub user-attachment images are routed through the local proxy so the
 * browser does not need to authenticate against GitHub directly.
 */

export function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text)
}

const GITHUB_IMG_RE = /^https:\/\/(.*\.)?github(usercontent)?\.com\//i

/**
 * Returns a proxied URL for GitHub images, original URL otherwise.
 * connectorId defaults to 'github'.
 */
export function proxyImageUrl(src: string, connectorId = 'github'): string {
  if (GITHUB_IMG_RE.test(src) || src.startsWith('https://github.com/user-attachments/')) {
    return `/api/proxy/image?connectorId=${encodeURIComponent(connectorId)}&url=${encodeURIComponent(src)}`
  }
  return src
}

/**
 * Processes HTML description:
 * - Replaces GitHub image src with proxy URL
 * - Wraps each <img> with a link that opens the original image in a new tab
 * - Adds target="_blank" + rel="noopener" to existing <a> tags
 */
export function processHtmlDescription(html: string, connectorId = 'github'): string {
  // Wrap <img> tags with an anchor pointing to the original src
  let result = html.replace(
    /<img(\s[^>]*)?\s*\/?>/gi,
    (imgTag) => {
      const srcMatch = imgTag.match(/src=["']([^"']+)["']/i)
      if (!srcMatch) return imgTag
      const originalSrc = srcMatch[1]
      const proxied = proxyImageUrl(originalSrc, connectorId)
      // Replace src with proxied URL
      const proxiedImg = imgTag.replace(srcMatch[0], `src="${proxied}"`)
      return `<span class="dt-img-wrap" style="display:inline-block;position:relative;">${proxiedImg}<a href="${originalSrc}" target="_blank" rel="noopener" class="dt-img-link" title="Abrir imagen" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.65);border-radius:3px;padding:2px 5px;font-size:10px;color:#d4d4d4;text-decoration:none;line-height:1.4;">↗</a></span>`
    }
  )

  // Ensure external links open in new tab
  result = result.replace(/<a\s/gi, '<a target="_blank" rel="noopener" ')

  return result
}

