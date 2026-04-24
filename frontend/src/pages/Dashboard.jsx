import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import AppLayout from '../components/layout/AppLayout'
import ScoreRing from '../components/ui/ScoreRing'
import GateBadge from '../components/ui/GateBadge'
import { GitBranch, Plus, Activity, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function StatCard({ label, value, sub, color = 'green' }) {
  const colors = { green: 'text-accent-green', red: 'text-accent-red', amber: 'text-accent-amber', blue: 'text-accent-blue' }
  return (
    <div className="card p-5">
      <div className={`font-mono font-bold text-3xl ${colors[color]}`}>{value}</div>
      <div className="font-mono text-sm text-txt-primary mt-1">{label}</div>
      {sub && <div className="font-mono text-xs text-txt-muted mt-0.5">{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card-raised px-3 py-2 text-xs font-mono">
      <div className="text-txt-muted mb-1">{label}</div>
      <div className="text-accent-green">{payload[0]?.value?.toFixed(2)} / 10</div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [repos, setRepos] = useState([])
  const [repoAnalyses, setRepoAnalyses] = useState({}) // repoId -> analyses[]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const r = await api.getRegisteredRepos()
      setRepos(r)
      // Fetch recent analyses for each repo
      const all = await Promise.all(r.map(repo => api.getRepoAnalyses(repo.id).then(a => [repo.id, a])))
      setRepoAnalyses(Object.fromEntries(all))
    } catch(e) {}
    setLoading(false)
  }

  // Aggregate stats
  const allAnalyses = Object.values(repoAnalyses).flat()
  const doneAnalyses = allAnalyses.filter(a => a.status === 'done')
  const passCount = doneAnalyses.filter(a => a.passed_gate).length
  const failCount = doneAnalyses.filter(a => !a.passed_gate).length
  const avgScore = doneAnalyses.length ? (doneAnalyses.reduce((s, a) => s + a.quality_score, 0) / doneAnalyses.length).toFixed(1) : '—'

  // Recent activity (last 10 across all repos)
  const recent = [...allAnalyses]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)

  // Trend data for first repo
  const trendRepo = repos[0]
  const trendData = trendRepo
    ? (repoAnalyses[trendRepo.id] || [])
        .filter(a => a.status === 'done')
        .slice(0, 20)
        .reverse()
        .map((a, i) => ({ i: i + 1, score: a.quality_score, sha: a.commit_sha }))
    : []

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono font-bold text-2xl text-txt-primary">
              <span className="text-accent-green">$</span> dashboard
            </h1>
            <p className="font-mono text-txt-muted text-sm mt-1">
              Welcome back, @{user?.login}<span className="animate-blink">_</span>
            </p>
          </div>
          <button onClick={loadData} className="btn-ghost flex items-center gap-2">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Repos monitored" value={repos.length} sub="registered" color="blue" />
          <StatCard label="Avg quality score" value={avgScore} sub="across all analyses" color="green" />
          <StatCard label="Gates passed" value={passCount} sub="total analyses" color="green" />
          <StatCard label="Gates failed" value={failCount} sub="builds blocked" color="red" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score trend */}
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-mono font-bold text-txt-primary text-sm">Score trend</h2>
                <p className="font-mono text-txt-muted text-xs mt-0.5">
                  {trendRepo ? trendRepo.full_name : 'No repos yet'}
                </p>
              </div>
              <TrendingUp size={16} className="text-txt-muted" />
            </div>
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <XAxis dataKey="sha" hide />
                  <YAxis domain={[0, 10]} hide />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={trendRepo?.quality_threshold || 7} stroke="#ffab00" strokeDasharray="4 4" strokeWidth={1} />
                  <Line
                    type="monotone" dataKey="score"
                    stroke="#00e676" strokeWidth={2}
                    dot={{ fill: '#00e676', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#00e676' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center">
                <p className="font-mono text-txt-muted text-sm">Run some analyses to see trend data</p>
              </div>
            )}
            {trendRepo && (
              <div className="flex items-center gap-2 mt-3">
                <div className="w-8 h-px bg-accent-amber opacity-50" style={{ borderTop: '1px dashed #ffab00' }} />
                <span className="font-mono text-xs text-txt-muted">threshold ({trendRepo.quality_threshold}/10)</span>
              </div>
            )}
          </div>

          {/* Repos summary */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-mono font-bold text-txt-primary text-sm">Repositories</h2>
              <Link to="/add-repo" className="text-accent-green hover:text-opacity-80 transition-colors">
                <Plus size={16} />
              </Link>
            </div>
            {repos.length === 0 ? (
              <div className="space-y-3">
                <p className="font-mono text-txt-muted text-xs">No repos registered yet.</p>
                <Link to="/add-repo" className="btn-primary block text-center text-xs">
                  + Add your first repo
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {repos.slice(0, 5).map(repo => {
                  const analyses = repoAnalyses[repo.id] || []
                  const last = analyses[0]
                  return (
                    <Link
                      key={repo.id}
                      to={`/repos/${repo.id}`}
                      className="flex items-center justify-between py-2.5 border-b border-bg-border last:border-0 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GitBranch size={12} className="text-txt-muted flex-shrink-0" />
                        <span className="font-mono text-xs text-txt-primary truncate">{repo.name}</span>
                      </div>
                      {last ? (
                        <span className={`font-mono text-xs font-bold ${
                          last.quality_score >= repo.quality_threshold ? 'text-accent-green' : 'text-accent-red'
                        }`}>
                          {last.quality_score?.toFixed(1)}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-txt-muted">—</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity size={15} className="text-txt-muted" />
            <h2 className="font-mono font-bold text-txt-primary text-sm">Recent activity</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-bg-raised rounded animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="font-mono text-txt-muted text-sm">No analyses yet. Register a repo and push some code!</p>
          ) : (
            <div className="space-y-1">
              {recent.map(a => {
                const repo = repos.find(r => r.id === a.repo_id) || {}
                return (
                  <Link
                    key={a.id}
                    to={`/analysis/${a.id}`}
                    className="flex items-center gap-4 px-4 py-3 rounded hover:bg-bg-raised transition-colors group"
                  >
                    <GateBadge passed={a.passed_gate} status={a.status} size="sm" />
                    <code className="font-mono text-xs text-accent-blue flex-shrink-0">{a.commit_sha}</code>
                    <span className="font-mono text-xs text-txt-secondary truncate flex-1">
                      {a.commit_message || 'No message'}
                    </span>
                    <span className="font-mono text-xs text-txt-muted flex-shrink-0">{repo.name || `repo#${a.repo_id}`}</span>
                    <span className={`font-mono text-xs font-bold flex-shrink-0 ${
                      a.quality_score >= (repo.quality_threshold || 7) ? 'text-accent-green' : 'text-accent-red'
                    }`}>
                      {a.status === 'done' ? `${a.quality_score?.toFixed(1)}/10` : '—'}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
