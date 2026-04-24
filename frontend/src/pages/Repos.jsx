import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import AppLayout from '../components/layout/AppLayout'
import GateBadge from '../components/ui/GateBadge'
import ScoreRing from '../components/ui/ScoreRing'
import { GitBranch, Webhook, Plus, ChevronRight, Play, Loader } from 'lucide-react'

export default function Repos() {
  const [repos, setRepos] = useState([])
  const [analyses, setAnalyses] = useState({})
  const [triggering, setTriggering] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadRepos() }, [])

  async function loadRepos() {
    setLoading(true)
    const r = await api.getRegisteredRepos()
    setRepos(r)
    const all = await Promise.all(r.map(repo => api.getRepoAnalyses(repo.id).then(a => [repo.id, a])))
    setAnalyses(Object.fromEntries(all))
    setLoading(false)
  }

  async function triggerManual(repo) {
    setTriggering(t => ({ ...t, [repo.id]: true }))
    try {
      await api.triggerAnalysis({ repo_id: repo.id, branch: 'main' })
      setTimeout(() => { loadRepos(); setTriggering(t => ({ ...t, [repo.id]: false })) }, 3000)
    } catch(e) {
      setTriggering(t => ({ ...t, [repo.id]: false }))
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono font-bold text-2xl text-txt-primary">
              <span className="text-accent-green">$</span> repos
            </h1>
            <p className="font-mono text-txt-muted text-sm mt-1">
              {repos.length} repo{repos.length !== 1 ? 's' : ''} monitored
            </p>
          </div>
          <Link to="/add-repo" className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add repo
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 card animate-pulse" />)}
          </div>
        ) : repos.length === 0 ? (
          <div className="card p-12 text-center space-y-4">
            <GitBranch size={32} className="text-txt-muted mx-auto" />
            <p className="font-mono text-txt-secondary">No repositories registered yet.</p>
            <Link to="/add-repo" className="btn-primary inline-flex items-center gap-2">
              <Plus size={14} /> Register your first repo
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {repos.map(repo => {
              const repoAnalyses = analyses[repo.id] || []
              const last = repoAnalyses[0]
              const passed = repoAnalyses.filter(a => a.status === 'done' && a.passed_gate).length
              const total = repoAnalyses.filter(a => a.status === 'done').length
              return (
                <div key={repo.id} className="card p-5 hover:border-bg-hover transition-colors">
                  <div className="flex items-start gap-5">
                    {/* Score ring */}
                    <div className="flex-shrink-0">
                      {last?.status === 'done' ? (
                        <ScoreRing score={last.quality_score} size={80} threshold={repo.quality_threshold} />
                      ) : (
                        <div className="w-20 h-20 rounded-full border-2 border-bg-border flex items-center justify-center">
                          <span className="font-mono text-txt-muted text-xs">—</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <Link to={`/repos/${repo.id}`} className="font-mono font-bold text-txt-primary hover:text-accent-green transition-colors">
                          {repo.full_name}
                        </Link>
                        {repo.webhook_active ? (
                          <span className="badge-pass text-xs"><Webhook size={10} />webhook active</span>
                        ) : (
                          <span className="badge-pending text-xs"><Webhook size={10} />no webhook</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        {last && <GateBadge passed={last.passed_gate} status={last.status} size="sm" />}
                        <span className="font-mono text-xs text-txt-muted">
                          threshold: <span className="text-accent-amber">{repo.quality_threshold}/10</span>
                        </span>
                        <span className="font-mono text-xs text-txt-muted">
                          {passed}/{total} passed
                        </span>
                      </div>

                      {/* Last commit */}
                      {last && (
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-accent-blue">{last.commit_sha}</code>
                          <span className="font-mono text-xs text-txt-muted truncate">{last.commit_message}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => triggerManual(repo)}
                        disabled={triggering[repo.id]}
                        className="btn-ghost flex items-center gap-2 text-xs"
                      >
                        {triggering[repo.id]
                          ? <Loader size={12} className="animate-spin" />
                          : <Play size={12} />
                        }
                        {triggering[repo.id] ? 'Running…' : 'Run now'}
                      </button>
                      <Link to={`/repos/${repo.id}`} className="btn-ghost flex items-center gap-1 text-xs">
                        View <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
