import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import AppLayout from '../components/layout/AppLayout'
import ScoreRing from '../components/ui/ScoreRing'
import GateBadge from '../components/ui/GateBadge'
import { GitBranch, Play, Loader, ChevronRight, Settings, TrendingUp, GitPullRequest, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card-raised px-3 py-2 text-xs font-mono space-y-1">
      <div className="text-accent-blue">{d.sha}</div>
      <div className="text-txt-secondary truncate max-w-48">{d.msg}</div>
      <div className={`font-bold ${d.passed ? 'text-accent-green' : 'text-accent-red'}`}>
        {d.score.toFixed(2)}/10
      </div>
    </div>
  )
}

export default function RepoDetail() {
  const { repoId } = useParams()
  const [repo, setRepo] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [branch, setBranch] = useState('main')
  const [threshold, setThreshold] = useState(7.0)
  const [savingThreshold, setSavingThreshold] = useState(false)

  useEffect(() => { load() }, [repoId])

  async function load() {
    setLoading(true)
    const [repos, a] = await Promise.all([
      api.getRegisteredRepos(),
      api.getRepoAnalyses(Number(repoId)),
    ])
    const r = repos.find(r => r.id === Number(repoId))
    setRepo(r)
    setThreshold(r?.quality_threshold || 7.0)
    setAnalyses(a)
    setLoading(false)
  }

  async function runAnalysis() {
    setTriggering(true)
    await api.triggerAnalysis({ repo_id: Number(repoId), branch })
    await new Promise(r => setTimeout(r, 2000))
    await load()
    setTriggering(false)
  }

  async function saveThreshold() {
    setSavingThreshold(true)
    await api.updateThreshold(Number(repoId), threshold)
    setSavingThreshold(false)
    await load()
  }

  const done = analyses.filter(a => a.status === 'done')
  const trendData = [...done].reverse().slice(0, 30).map(a => ({
    sha: a.commit_sha,
    score: a.quality_score,
    passed: a.passed_gate,
    msg: a.commit_message,
    branch: a.branch,
  }))

  if (loading) return (
    <AppLayout>
      <div className="flex items-center gap-2 font-mono text-txt-muted text-sm">
        <Loader size={14} className="animate-spin" /> Loading…
      </div>
    </AppLayout>
  )

  const last = analyses[0]

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-txt-muted text-sm mb-1">
              <Link to="/repos" className="hover:text-txt-primary transition-colors">repos</Link>
              <span>/</span>
              <span className="text-txt-primary">{repo?.name}</span>
            </div>
            <h1 className="font-mono font-bold text-2xl text-txt-primary">{repo?.full_name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              placeholder="branch"
              className="bg-bg-surface border border-bg-border rounded px-3 py-2 font-mono text-xs text-txt-primary placeholder-txt-muted focus:outline-none focus:border-accent-green focus:border-opacity-50 w-28"
            />
            <button
              onClick={runAnalysis}
              disabled={triggering}
              className="btn-primary flex items-center gap-2 text-xs"
            >
              {triggering ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
              {triggering ? 'Running…' : 'Run analysis'}
            </button>
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Latest score */}
          <div className="card p-5 flex items-center gap-5">
            {last?.status === 'done'
              ? <ScoreRing score={last.quality_score} size={88} threshold={repo?.quality_threshold} />
              : <div className="w-22 h-22 rounded-full border-2 border-bg-border flex items-center justify-center w-[88px] h-[88px]">
                  <span className="font-mono text-txt-muted text-xs">—</span>
                </div>
            }
            <div>
              <div className="font-mono text-xs text-txt-muted mb-1">Latest score</div>
              {last ? <GateBadge passed={last.passed_gate} status={last.status} /> : <span className="font-mono text-txt-muted text-xs">No analyses</span>}
              <div className="font-mono text-xs text-txt-muted mt-2">
                threshold: <span className="text-accent-amber">{repo?.quality_threshold}/10</span>
              </div>
            </div>
          </div>

          {/* Pass rate */}
          <div className="card p-5">
            <div className="font-mono text-xs text-txt-muted mb-2">Pass rate</div>
            <div className="font-mono font-bold text-3xl text-txt-primary mb-1">
              {done.length ? Math.round((done.filter(a => a.passed_gate).length / done.length) * 100) : 0}%
            </div>
            <div className="font-mono text-xs text-txt-muted">
              {done.filter(a => a.passed_gate).length} / {done.length} analyses passed
            </div>
            <div className="mt-3 h-1.5 bg-bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-green rounded-full transition-all duration-500"
                style={{ width: done.length ? `${(done.filter(a => a.passed_gate).length / done.length) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {/* Threshold config */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Settings size={13} className="text-txt-muted" />
              <div className="font-mono text-xs text-txt-muted">Quality threshold</div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-txt-secondary">Gate score</span>
              <span className="font-mono font-bold text-accent-amber">{threshold.toFixed(1)}/10</span>
            </div>
            <input
              type="range" min="0" max="10" step="0.5"
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full accent-accent-green mb-3"
            />
            <button
              onClick={saveThreshold}
              disabled={savingThreshold || threshold === repo?.quality_threshold}
              className="btn-ghost text-xs w-full"
            >
              {savingThreshold ? 'Saving…' : 'Save threshold'}
            </button>
          </div>
        </div>

        {/* Score trend chart */}
        {trendData.length > 1 && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={15} className="text-txt-muted" />
              <h2 className="font-mono font-bold text-txt-primary text-sm">Score trend</h2>
              <span className="font-mono text-xs text-txt-muted">last {trendData.length} analyses</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid stroke="#1f252e" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="sha" hide />
                <YAxis domain={[0, 10]} tickCount={6} tick={{ fill: '#4a5568', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={repo?.quality_threshold || 7} stroke="#ffab00" strokeDasharray="4 4" strokeWidth={1.5} />
                <Line
                  type="monotone" dataKey="score"
                  stroke="#00e676" strokeWidth={2}
                  dot={({ cx, cy, payload }) => (
                    <circle key={cx} cx={cx} cy={cy} r={4}
                      fill={payload.passed ? '#00e676' : '#ff4444'}
                      stroke="none"
                    />
                  )}
                  activeDot={{ r: 6, fill: '#00e676' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Analysis history table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-bg-border flex items-center gap-2">
            <Zap size={14} className="text-txt-muted" />
            <h2 className="font-mono font-bold text-txt-primary text-sm">Analysis history</h2>
          </div>
          <div className="divide-y divide-bg-border">
            {analyses.length === 0 ? (
              <div className="px-6 py-10 text-center font-mono text-txt-muted text-sm">
                No analyses yet — push code or click "Run analysis"
              </div>
            ) : analyses.map(a => (
              <Link
                key={a.id}
                to={`/analysis/${a.id}`}
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-bg-raised transition-colors"
              >
                <GateBadge passed={a.passed_gate} status={a.status} size="sm" />
                <code className="font-mono text-xs text-accent-blue flex-shrink-0 w-14">{a.commit_sha}</code>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-txt-secondary truncate">{a.commit_message || '—'}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono text-xs text-txt-muted">{a.branch}</span>
                    {a.pr_number && (
                      <span className="flex items-center gap-1 font-mono text-xs text-accent-purple">
                        <GitPullRequest size={10} />PR #{a.pr_number}
                      </span>
                    )}
                    <span className="font-mono text-xs text-txt-muted capitalize">{a.trigger}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {a.status === 'done' ? (
                    <span className={`font-mono text-sm font-bold ${a.passed_gate ? 'text-accent-green' : 'text-accent-red'}`}>
                      {a.quality_score?.toFixed(1)}/10
                    </span>
                  ) : <span className="font-mono text-xs text-txt-muted">{a.status}</span>}
                  <div className="font-mono text-xs text-txt-muted">
                    {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>
                <ChevronRight size={14} className="text-txt-muted flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
