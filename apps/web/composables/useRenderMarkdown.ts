/**
 * Renders GitHub-flavored markdown (issue/comment bodies) to sanitized HTML.
 * `marked` handles parsing (GFM: tables, strikethrough, task lists, fenced code),
 * `DOMPurify` sanitizes the output since the body is third-party content from the GitHub API.
 */
import {marked} from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({gfm: true, breaks: true})

export function renderMarkdown(text: string): string {
  const rawHtml = marked.parse(text, {async: false}) as string
  const safeHtml = DOMPurify.sanitize(rawHtml, {ADD_ATTR: ['target', 'rel']})
  // Open links in a new tab (bodies are rendered inside the IDE webview)
  return safeHtml.replace(/<a\s/gi, '<a target="_blank" rel="noopener" ')
}
