import type {
  TaskConnector,
  ConnectorTask,
  ConnectorCapabilities,
  ConnectorConfigSchema,
  ConnectorSource,
  TaskComment,
  TaskFilter,
  TaskPatch,
  NewTask,
  TaskLabel,
  TaskUser,
} from '@dynamia-tasks/core'

interface GithubConfig {
  token?: string
  repos?: string[]
}

interface GhIssue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: { id: number; name: string; color: string }[]
  assignees: { id: number; login: string; avatar_url: string }[]
  user: { id: number; login: string; avatar_url: string } | null
  comments: number
  created_at: string
  updated_at: string
  // sub-issues count (GA April 2025)
  sub_issues_summary?: { total: number; completed: number }
}

interface GhRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
}

interface GhComment {
  id: number
  body: string
  user: { id: number; login: string; avatar_url: string } | null
  created_at: string
  updated_at: string
}

export class GithubConnector implements TaskConnector {
  readonly id = 'github'
  readonly name = 'GitHub Issues'
  readonly icon = '🐙'
  readonly capabilities: ConnectorCapabilities = {
    canCreate: true,
    canDelete: false,
    canEdit: true,
    canComment: true,
    canSubtasks: true,
    canAssign: true,
    canLabel: true,
    hasDetail: true,
    hasExplorer: true,
  }

  private config: GithubConfig = {}

  async isConfigured(): Promise<boolean> {
    return !!this.config.token
  }

  async configure(config: unknown): Promise<void> {
    this.config = (config ?? {}) as GithubConfig
  }

  getConfigSchema(): ConnectorConfigSchema {
    return {
      fields: [
        {
          key: 'token',
          label: 'Personal Access Token',
          type: 'password',
          required: true,
          placeholder: 'ghp_...',
          helpText: 'GitHub PAT with private repo access (classic: repo, fine-grained: Metadata + Issues)',
        },
      ],
    }
  }

  private async request<T>(token: string | undefined, path: string, options?: RequestInit): Promise<T> {
    if (!token) throw Object.assign(new Error('GitHub token is not configured'), { code: 'UPSTREAM_AUTH_FAILED' })
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/vnd.github+json',
        ...(options?.headers ?? {}),
      },
    })
    if (res.status === 401) throw Object.assign(new Error('GitHub auth failed'), { code: 'UPSTREAM_AUTH_FAILED' })
    if (res.status === 429 || (res.status === 403 && (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after')))) {
      throw Object.assign(new Error('GitHub rate limited'), { code: 'UPSTREAM_RATE_LIMITED' })
    }
    if (res.status === 403) {
      throw Object.assign(new Error('GitHub denied access: check the token scopes and repository permissions'), { code: 'UPSTREAM_FORBIDDEN' })
    }
    if (!res.ok) {
      let detail = ''
      try {
        const payload = await res.json() as { message?: string; errors?: Array<{ message?: string }> }
        const messages = [payload?.message, ...(payload?.errors?.map(e => e.message).filter(Boolean) ?? [])].filter(Boolean)
        if (messages.length) detail = ` - ${messages.join('; ')}`
      } catch {
        // Ignore non-JSON API errors and keep the generic status message.
      }
      const error = new Error(`GitHub API error: ${res.status}${detail || ` ${res.statusText}`}`)
      throw res.status === 422 ? Object.assign(error, { code: 'UPSTREAM_VALIDATION_FAILED' }) : error
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  private gh<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(this.config.token, path, options)
  }

  /** Runs `fn` over `items` with at most `limit` in flight, keeping result order. */
  private async mapLimit<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
    const out = new Array<O>(items.length)
    let next = 0
    const worker = async () => {
      while (next < items.length) {
        const index = next++
        out[index] = await fn(items[index])
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
    return out
  }

  /** "owner/repo" → validated parts; they end up in URL paths, so reject anything unexpected. */
  private parseRepo(full: string): { owner: string; repo: string } {
    const match = /^(?!\.{1,2}\/)([\w.-]+)\/(?!\.{1,2}$)([\w.-]+)$/.exec(full ?? '')
    if (!match) throw new Error(`Invalid repository "${full}": expected owner/repo`)
    return { owner: match[1], repo: match[2] }
  }

  // Parse "num@owner/repo" → { number, owner, repo }
  /** Configured repos with a malformed entry skipped (and logged) instead of breaking every repo. */
  private validConfiguredRepos(): { owner: string; repo: string }[] {
    const out: { owner: string; repo: string }[] = []
    for (const full of this.config.repos ?? []) {
      try {
        out.push(this.parseRepo(full))
      } catch (e) {
        console.warn(`[connector-github] ignoring configured repo: ${(e as Error).message}`)
      }
    }
    return out
  }

  private parseId(id: string): { number: number; owner: string; repo: string } {
    const [numStr, full] = (id ?? '').split('@')
    if (!/^\d+$/.test(numStr ?? '') || !full) throw new Error(`Invalid GitHub task id "${id}": expected number@owner/repo`)
    return { number: parseInt(numStr, 10), ...this.parseRepo(full) }
  }

  private toTask(issue: GhIssue, owner: string, repo: string): ConnectorTask {
    const labels: TaskLabel[] = issue.labels.map(l => ({
      id: String(l.id),
      name: l.name,
      color: l.color,
    }))
    const assignees: TaskUser[] = issue.assignees.map(a => ({
      id: String(a.id),
      login: a.login,
      avatarUrl: a.avatar_url,
    }))
    const author: TaskUser | undefined = issue.user
      ? { id: String(issue.user.id), login: issue.user.login, avatarUrl: issue.user.avatar_url }
      : undefined

    return {
      id: `${issue.number}@${owner}/${repo}`,
      connectorId: 'github',
      sourceId: `${owner}/${repo}`,
      title: issue.title,
      description: issue.body ?? undefined,
      done: issue.state === 'closed',
      labels,
      assignees,
      author,
      commentsCount: issue.comments,
      subtasksCount: issue.sub_issues_summary?.total,
      subtasksDoneCount: issue.sub_issues_summary?.completed,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      meta: { number: issue.number, owner, repo },
    }
  }

  async fetchTasks(filter?: TaskFilter): Promise<ConnectorTask[]> {
    if (!this.config.token) return []

    let repos = await this.resolveRepos()
    if (filter?.sourceId) {
      repos = repos.filter(r => `${r.owner}/${r.repo}` === filter.sourceId)
    }
    const status = filter?.status ?? 'open'
    const state = status === 'all' ? 'all' : status === 'closed' ? 'closed' : 'open'
    const perPage = filter?.perPage ?? 50
    const page = filter?.page ?? 1

    const query = filter?.query?.trim().toLowerCase()
    const perRepo = await this.mapLimit(repos, 4, async ({ owner, repo }) => {
      const params = new URLSearchParams({ state, per_page: String(perPage), page: String(page) })
      if (filter?.labels?.length) params.set('labels', filter.labels.join(','))
      try {
        const issues = await this.gh<GhIssue[]>(`/repos/${owner}/${repo}/issues?${params}`)
        // GitHub issues endpoint returns PRs too — filter them out
        return issues.filter(i => !(i as any).pull_request).map(i => this.toTask(i, owner, repo))
      } catch (e) {
        const message = (e as Error).message
        // If the explorer requested a single source, surface the error instead of returning a misleading empty list.
        if (filter?.sourceId) {
          throw new Error(
            `Unable to load issues for ${owner}/${repo}. ${message}. Check token access to private repos (classic: repo, fine-grained: Metadata + Issues).`
          )
        }
        console.warn(`[connector-github] fetchTasks failed for ${owner}/${repo}:`, message)
        return []
      }
    })
    const results = perRepo.flat()
    // The issues endpoint has no text search (that is the search API), so filter here.
    return query
      ? results.filter(t => t.title.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query))
      : results
  }

  async getTask(id: string): Promise<ConnectorTask> {
    const { number, owner, repo } = this.parseId(id)
    const issue = await this.gh<GhIssue>(`/repos/${owner}/${repo}/issues/${number}`)
    return this.toTask(issue, owner, repo)
  }

  async createTask(newTask: NewTask): Promise<ConnectorTask> {
    // Requires sourceId (owner/repo) passed from the UI
    const sourceId = newTask.sourceId as string | undefined
    if (!sourceId) throw new Error('createTask requires sourceId (owner/repo)')
    const { owner, repo } = this.parseRepo(sourceId)

    const body: Record<string, unknown> = { title: newTask.title, body: newTask.description }
    if (newTask.labels?.length) body.labels = newTask.labels

    const issue = await this.gh<GhIssue>(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    return this.toTask(issue, owner, repo)
  }

  async updateTask(id: string, patch: TaskPatch): Promise<ConnectorTask> {
    const { number, owner, repo } = this.parseId(id)
    const body: Record<string, unknown> = {}
    if (patch.title !== undefined) body.title = patch.title
    if (patch.description !== undefined) body.body = patch.description
    if (patch.done !== undefined) body.state = patch.done ? 'closed' : 'open'
    if (patch.labels !== undefined) body.labels = patch.labels

    const issue = await this.gh<GhIssue>(`/repos/${owner}/${repo}/issues/${number}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    return this.toTask(issue, owner, repo)
  }

  async fetchComments(taskId: string): Promise<TaskComment[]> {
    const { number, owner, repo } = this.parseId(taskId)
    const comments = await this.gh<GhComment[]>(`/repos/${owner}/${repo}/issues/${number}/comments`)
    return comments.map(c => ({
      id: String(c.id),
      body: c.body,
      author: c.user
        ? { id: String(c.user.id), login: c.user.login, avatarUrl: c.user.avatar_url }
        : { id: 'unknown', login: 'unknown' },
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }))
  }

  async addComment(taskId: string, body: string): Promise<TaskComment> {
    const { number, owner, repo } = this.parseId(taskId)
    const comment = await this.gh<GhComment>(`/repos/${owner}/${repo}/issues/${number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
      headers: { 'Content-Type': 'application/json' },
    })
    return {
      id: String(comment.id),
      body: comment.body,
      author: comment.user
        ? { id: String(comment.user.id), login: comment.user.login, avatarUrl: comment.user.avatar_url }
        : { id: 'unknown', login: 'unknown' },
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    }
  }

  async fetchSubtasks(taskId: string): Promise<ConnectorTask[]> {
    const { number, owner, repo } = this.parseId(taskId)
    const issues = await this.gh<GhIssue[]>(`/repos/${owner}/${repo}/issues/${number}/sub_issues`)
    return issues.map(i => this.toTask(i, owner, repo))
  }

  async addSubtask(parentId: string, childId: string): Promise<void> {
    const { number: parentNum, owner, repo } = this.parseId(parentId)
    const { number: childNum } = this.parseId(childId)
    await this.gh(`/repos/${owner}/${repo}/issues/${parentNum}/sub_issues`, {
      method: 'POST',
      body: JSON.stringify({ sub_issue_id: childNum }),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async removeSubtask(parentId: string, childId: string): Promise<void> {
    const { number: parentNum, owner, repo } = this.parseId(parentId)
    const { number: childNum } = this.parseId(childId)
    await this.gh(`/repos/${owner}/${repo}/issues/${parentNum}/sub_issues/${childNum}`, {
      method: 'DELETE',
    })
  }

  async fetchLabels(sourceId?: string): Promise<TaskLabel[]> {
    if (!sourceId) return []
    const { owner, repo } = this.parseRepo(sourceId)
    const ghLabels = await this.gh<{ id: number; name: string; color: string }[]>(
      `/repos/${owner}/${repo}/labels?per_page=100`
    )
    return ghLabels.map(l => ({ id: String(l.id), name: l.name, color: l.color }))
  }

  async fetchSources(): Promise<ConnectorSource[]> {
    if (!this.config.token) return []
    // If the user has selected specific repos, return only those
    if (this.config.repos?.length) {
      return this.validConfiguredRepos().map(({ owner, repo }) => ({ id: `${owner}/${repo}`, name: repo, group: owner }))
    }
    return this.fetchSourcesWithToken(this.config.token)
  }

  /** Fetch repos/sources using an arbitrary token — used by the settings UI before saving */
  async fetchSourcesWithToken(token: string, orgs: string[] = []): Promise<ConnectorSource[]> {
    const ghWithToken = <T>(path: string): Promise<T> => this.request<T>(token, path)

    const fetchAllPages = async (baseUrl: string): Promise<GhRepo[]> => {
      const all: GhRepo[] = []
      let page = 1
      while (true) {
        const sep = baseUrl.includes('?') ? '&' : '?'
        const batch = await ghWithToken<GhRepo[]>(`${baseUrl}${sep}per_page=100&page=${page}`)
        all.push(...batch)
        if (batch.length < 100) break
        page++
      }
      return all
    }

    const fetchAllPagesWithFallback = async (baseUrls: string[]): Promise<GhRepo[]> => {
      let lastValidationError: Error | null = null
      for (const baseUrl of baseUrls) {
        try {
          return await fetchAllPages(baseUrl)
        } catch (e) {
          const err = e as Error & { code?: string }
          if (err.code === 'UPSTREAM_VALIDATION_FAILED') {
            lastValidationError = err
            continue
          }
          throw err
        }
      }
      throw (lastValidationError ?? new Error('GitHub API error: 422'))
    }

    const sources: ConnectorSource[] = []

    if (orgs.length > 0) {
      for (const org of orgs) {
        try {
          const repos = await fetchAllPages(`/orgs/${encodeURIComponent(org)}/repos?sort=updated`)
          repos.forEach(r => sources.push({ id: r.full_name, name: r.name, group: org }))
        } catch {
          console.warn(`[connector-github] fetchSourcesWithToken failed for org ${org}`)
        }
      }
    } else {
      const repos = await fetchAllPagesWithFallback([
        '/user/repos?sort=updated&affiliation=owner,collaborator,organization_member',
        '/user/repos?sort=updated&type=all',
        '/user/repos?sort=updated',
      ])
      repos.forEach(r => sources.push({ id: r.full_name, name: r.name, group: r.owner.login }))
    }

    return sources
  }

  private async resolveRepos(): Promise<{ owner: string; repo: string }[]> {
    if (this.config.repos?.length) {
      return this.validConfiguredRepos()
    }
    const sources = await this.fetchSources()
    return sources.map(s => this.parseRepo(s.id))
  }
}


