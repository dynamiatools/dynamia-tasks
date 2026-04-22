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
          helpText: 'GitHub PAT with repo scope',
        },
      ],
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
    }
  }

  private async gh<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: { ...this.headers(), ...(options?.headers ?? {}) },
    })
    if (res.status === 401) throw Object.assign(new Error('GitHub auth failed'), { code: 'UPSTREAM_AUTH_FAILED' })
    if (res.status === 403) throw Object.assign(new Error('GitHub rate limited'), { code: 'UPSTREAM_RATE_LIMITED' })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
    return res.json() as Promise<T>
  }

  // Parse "num@owner/repo" → { number, owner, repo }
  private parseId(id: string): { number: number; owner: string; repo: string } {
    const [numStr, full] = id.split('@')
    const [owner, repo] = full.split('/')
    return { number: parseInt(numStr, 10), owner, repo }
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

    const results: ConnectorTask[] = []
    for (const { owner, repo } of repos) {
      let url = `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}&page=${page}&pulls=false`
      if (filter?.labels?.length) url += `&labels=${filter.labels.join(',')}`
      if (filter?.query) url += `&q=${encodeURIComponent(filter.query)}`

      try {
        const issues = await this.gh<GhIssue[]>(url)
        // GitHub issues endpoint returns PRs too — filter them out
        results.push(...issues.filter(i => !(i as any).pull_request).map(i => this.toTask(i, owner, repo)))
      } catch (e) {
        console.warn(`[connector-github] fetchTasks failed for ${owner}/${repo}:`, (e as Error).message)
      }
    }
    return results
  }

  async getTask(id: string): Promise<ConnectorTask> {
    const { number, owner, repo } = this.parseId(id)
    const issue = await this.gh<GhIssue>(`/repos/${owner}/${repo}/issues/${number}`)
    return this.toTask(issue, owner, repo)
  }

  async createTask(newTask: NewTask): Promise<ConnectorTask> {
    // Requires sourceId (owner/repo) passed as extra field
    const sourceId = (newTask as any).sourceId as string | undefined
    if (!sourceId) throw new Error('createTask requires sourceId (owner/repo)')
    const [owner, repo] = sourceId.split('/')

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

  async fetchSources(): Promise<ConnectorSource[]> {
    if (!this.config.token) return []
    // If the user has selected specific repos, return only those
    if (this.config.repos?.length) {
      return this.config.repos.map(full => {
        const [owner, name] = full.split('/')
        return { id: full, name, group: owner }
      })
    }
    return this.fetchSourcesWithToken(this.config.token)
  }

  /** Fetch repos/sources using an arbitrary token — used by the settings UI before saving */
  async fetchSourcesWithToken(token: string, orgs: string[] = []): Promise<ConnectorSource[]> {
    const ghWithToken = async <T>(path: string): Promise<T> => {
      const res = await fetch(`https://api.github.com${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          Accept: 'application/vnd.github+json',
        },
      })
      if (res.status === 401) throw Object.assign(new Error('GitHub auth failed'), { code: 'UPSTREAM_AUTH_FAILED' })
      if (res.status === 403) throw Object.assign(new Error('GitHub rate limited'), { code: 'UPSTREAM_RATE_LIMITED' })
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
      return res.json() as Promise<T>
    }

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

    const sources: ConnectorSource[] = []

    if (orgs.length > 0) {
      for (const org of orgs) {
        try {
          const repos = await fetchAllPages(`/orgs/${org}/repos?sort=updated`)
          repos.forEach(r => sources.push({ id: r.full_name, name: r.name, group: org }))
        } catch {
          console.warn(`[connector-github] fetchSourcesWithToken failed for org ${org}`)
        }
      }
    } else {
      const repos = await fetchAllPages('/user/repos?sort=updated&affiliation=owner,collaborator,organization_member')
      repos.forEach(r => sources.push({ id: r.full_name, name: r.name, group: r.owner.login }))
    }

    return sources
  }

  private async resolveRepos(): Promise<{ owner: string; repo: string }[]> {
    if (this.config.repos?.length) {
      return this.config.repos.map(full => {
        const [owner, repo] = full.split('/')
        return { owner, repo }
      })
    }
    const sources = await this.fetchSources()
    return sources.map(s => {
      const [owner, repo] = s.id.split('/')
      return { owner, repo }
    })
  }
}


