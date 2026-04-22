/**
 * Extracts images and file attachments embedded in markdown text.
 * GitHub embeds them as: ![alt](url) for images, [name](url) for files
 */

export interface MarkdownImage {
  alt: string
  url: string        // proxied URL for display
  originalUrl: string // original URL for external links
}

export interface MarkdownAttachment {
  name: string
  url: string
}

export function useMarkdownExtract(text: string, connectorId = 'github') {
  // Images: ![alt](url)
  const images: MarkdownImage[] = []
  const imageRe = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = imageRe.exec(text)) !== null) {
    const originalUrl = m[2]
    images.push({ alt: m[1] || 'image', url: proxyImageUrl(originalUrl, connectorId), originalUrl })
  }

  // File attachments: [name](https://github.com/user-attachments/...) or other non-image links
  const attachments: MarkdownAttachment[] = []
  const linkRe = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  while ((m = linkRe.exec(text)) !== null) {
    const url = m[2]
    // Skip plain http links that are not file-like
    if (/\.(pdf|zip|tar|gz|png|jpg|jpeg|gif|svg|webp|mp4|mov|csv|xlsx|docx|txt|log)(\?|$)/i.test(url) ||
        url.includes('user-attachments') || url.includes('files.github')) {
      attachments.push({ name: m[1], url })
    }
  }

  // Strip image and attachment markdown from text for clean display
  const cleaned = text
    .replace(/!\[[^\]]*\]\(https?:\/\/[^)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { images, attachments, cleaned }
}

