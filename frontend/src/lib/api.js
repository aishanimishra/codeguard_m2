const BASE = '/api'

function getToken() {
  return localStorage.getItem('cg_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('cg_token')
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Auth
  getMe: () => request('/auth/me'),
  exchangeCode: (code) => request(`/auth/callback?code=${code}`),

  // Repos
  getGithubRepos: () => request('/repos/github'),
  getRegisteredRepos: () => request('/repos/registered'),
  registerRepo: (body) => request('/repos/register', { method: 'POST', body: JSON.stringify(body) }),
  updateThreshold: (repoId, threshold) =>
    request(`/repos/${repoId}/threshold`, { method: 'PATCH', body: JSON.stringify({ quality_threshold: threshold }) }),
  getRepoAnalyses: (repoId) => request(`/repos/${repoId}/analyses`),

  // Analysis
  triggerAnalysis: (body) => request('/analysis/trigger', { method: 'POST', body: JSON.stringify(body) }),
  getAnalysis: (id) => request(`/analysis/${id}`),
}
