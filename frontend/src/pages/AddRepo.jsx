import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import AppLayout from '../components/layout/AppLayout'
import { Search, GitBranch, Lock, Globe, Plus, Loader, CheckCircle } from 'lucide-react'

export default function AddRepo() {
  const [githubRepos, setGithubRepos] = useState([])
  const [registered, setRegistered] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(null)
  const [added, setAdded] = useState(null)
  const [threshold, setThreshold] = useState(7.0)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.getGithubRepos(), api.getRegisteredRepos()])
      .then(([gh, reg]) => { setGithubRepos(gh); setRegistered(reg) })
      .finally(() => setLoading(false))
  }, [])

  const registeredNames = new Set(registered.map(r => r.full_name))

  const filtered = githubRepos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd(repo) {
    setAdding(repo.full_name)
    try {
      await api.registerRepo({ repo_full_name: repo.full_name, quality_threshold: threshold })
      setAdded(repo.full_name)
      setRegistered(r => [...r, { full_name: repo.full_name, name: repo.name }])
      setTimeout(() => navigate('/repos'), 1500)
    } catch(e) {
      alert('Failed: ' + e.message)
    }
    setAdding(null)
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="font-mono font-bold text-2xl text-txt-primary">
            <span className="text-accent-green">$</span> add repo
          </h1>
          <p className="font-mono text-txt-muted text-sm mt-1">
            Select a GitHub repo to monitor with CodeGuard
          </p>
        </div>

        {/* Threshold config */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-mono text-sm font-bold text-txt-primary">Quality threshold</h2>
              <p className="font-mono text-xs text-txt-muted mt-0.5">Minimum Pylint score to pass the gate</p>
            </div>
            <span className="font-mono font-bold text-accent-amber text-lg">{threshold.toFixed(1)}/10</span>
          </div>
          <input
            type="range" min="0" max="10" step="0.5"
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-accent-green"
          />
          <div className="flex justify-between font-mono text-xs text-txt-muted mt-1">
            <span>0 (any)</span><span>5 (medium)</span><span>10 (perfect)</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            type="text"
            placeholder="Search repositories…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg-surface border border-bg-border rounded px-4 py-2.5 pl-9 font-mono text-sm text-txt-primary placeholder-txt-muted focus:outline-none focus:border-accent-green focus:border-opacity-50 transition-colors"
          />
        </div>

        {/* Repo list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 card animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map(repo => {
              const isRegistered = registeredNames.has(repo.full_name)
              const isAdding = adding === repo.full_name
              const wasAdded = added === repo.full_name

              return (
                <div
                  key={repo.id}
                  className={`card p-4 flex items-center gap-4 transition-all ${
                    isRegistered ? 'opacity-50' : 'hover:border-bg-hover'
                  }`}
                >
                  {repo.private
                    ? <Lock size={14} className="text-txt-muted flex-shrink-0" />
                    : <Globe size={14} className="text-txt-muted flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-txt-primary">{repo.full_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {repo.language && (
                        <span className="font-mono text-xs text-txt-muted">{repo.language}</span>
                      )}
                      {repo.private && (
                        <span className="font-mono text-xs text-txt-muted">· private</span>
                      )}
                    </div>
                  </div>

                  {isRegistered ? (
                    <span className="badge-pass text-xs"><CheckCircle size={10} />registered</span>
                  ) : wasAdded ? (
                    <span className="badge-pass text-xs"><CheckCircle size={10} />added!</span>
                  ) : (
                    <button
                      onClick={() => handleAdd(repo)}
                      disabled={isAdding}
                      className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
                    >
                      {isAdding ? <Loader size={11} className="animate-spin" /> : <Plus size={11} />}
                      {isAdding ? 'Adding…' : 'Add'}
                    </button>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="font-mono text-txt-muted text-sm text-center py-8">No repos match "{search}"</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
