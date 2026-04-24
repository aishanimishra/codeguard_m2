import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import AppLayout from '../components/layout/AppLayout'
import ScoreRing from '../components/ui/ScoreRing'
import GateBadge from '../components/ui/GateBadge'
import {
  ChevronDown, ChevronRight, FileCode, AlertTriangle,
  AlertCircle, Info, Wrench, Zap, Loader, GitCommit, GitPullRequest, User, Calendar
} from 'lucide-react'

const SEVERITY = {
  fatal:      { color: 'text-accent-red',    bg: 'bg-accent-red',    border: 'issue-fatal',      icon: AlertCircle,    label: 'Fatal'      },
  error:      { color: 'text-accent-red',    bg: 'bg-accent-red',    border: 'issue-error',      icon: AlertCircle,    label: 'Error'      },
  warning:    { color: 'text-accent-amber',  bg: 'bg-accent-amber',  border: 'issue-warning',    icon: AlertTriangle,  label: 'Warning'    },
  refactor:   { color: 'text-accent-purple', bg: 'bg-accent-purple', border: 'issue-refactor',   icon: Wrench,         label: 'Refactor'   },
  convention: { color: 'text-accent-blue',   bg: 'bg-accent-blue',   border: 'issue-convention', icon: Info,           label: 'Convention' },
}

function IssueCountBadge({ type, count }) {
  const s = SEVERITY[type] || SEVERITY.convention
  const Icon = s.icon
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-raised rounded border border-bg-border">
      <Icon size={12} className={s.color} />
      <span className={`font-mono text-xs font-bold ${s.color}`}>{count}</span>
      <span className="font-mono text-xs text-txt-muted capitalize">{type}</span>
    </div>
  )
}

function FileRow({ file, threshold }) {
  const [open, setOpen] = useState(file.error_count > 0)

  return (
    <div className="border-b border-bg-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bg-raised transition-colors text-left"
      >
        {open ? <ChevronDown size={13} className="text-txt-muted flex-shrink-0" /> : <ChevronRight size={13} className="text-txt-muted flex-shrink-0" />}
        <FileCode size={13} className="text-txt-muted flex-shrink-0" />
        <span className="font-mono text-xs text-txt-primary flex-1 truncate">{file.file}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {file.error_count > 0 && (
            <span className="badge-fail text-xs">{file.error_count} errors</span>
          )}
          <span className="font-mono text-xs text-txt-muted">{file.issue_count} issues</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-3 space-y-1.5">
          {file.issues.map((issue, i) => {
            const s = SEVERITY[issue.severity] || SEVERITY.convention
            const Icon = s.icon
            return (
              <div key={i} className={`flex gap-3 px-3 py-2 rounded bg-bg-raised ${s.border} pl-4`}>
                <div className="flex-shrink-0 flex items-start gap-1.5 mt-0.5">
                  <Icon size={11} className={s.color} />
                  <span className="font-mono text-xs text-txt-muted w-6 text-right">{issue.line}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-txt-secondary">{issue.message}</span>
                  <span className={`font-mono text-xs ml-2 ${s.color}`}>[{issue.symbol}]</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AnalysisDetail() {
  const { analysisId } = useParams()
  const [data, setData] = useState(null)
  const [repo, setRepo] = useState(null)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  useEffect(() => {
    load()
    return () => clearInterval(pollRef.current)
  }, [analysisId])

  async function load() {
    const a = await api.getAnalysis(Number(analysisId))
    setData(a)
    setLoading(false)

    // Poll while pending/running
    if (a.status === 'pending' || a.status === 'running') {
      pollRef.current = setInterval(async () => {
        const fresh = await api.getAnalysis(Number(analysisId))
        setData(fresh)
        if (fresh.status === 'done' || fresh.status === 'error') {
          clearInterval(pollRef.current)
        }
      }, 2500)
    }

    // Fetch repo info
    const repos = await api.getRegisteredRepos()
    setRepo(repos.find(r => r.id === a.repo_id))
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center gap-2 font-mono text-txt-muted text-sm">
        <Loader size={14} className="animate-spin" /> Loading analysis…
      </div>
    </AppLayout>
  )

  if (!data) return <AppLayout><p className="font-mono text-txt-muted">Analysis not found.</p></AppLayout>

  const isLive = data.status === 'pending' || data.status === 'running'
  const ic = data.issue_counts || {}
  const summary = data.summary || {}
  const files = data.file_results || []

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-mono text-txt-muted text-xs">
          <Link to="/repos" className="hover:text-txt-primary">repos</Link>
          <span>/</span>
          <Link to={`/repos/${data.repo_id}`} className="hover:text-txt-primary">{repo?.name || `#${data.repo_id}`}</Link>
          <span>/</span>
          <span className="text-accent-blue">{data.commit_sha?.slice(0, 7)}</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-6">
          {/* Score */}
          <div className={`flex-shrink-0 ${isLive ? 'opacity-40' : ''}`}>
            {isLive
              ? <div className="w-28 h-28 rounded-full border-2 border-bg-border flex items-center justify-center">
                  <Loader size={22} className="text-accent-green animate-spin" />
                </div>
              : <ScoreRing score={data.quality_score} size={112} threshold={repo?.quality_threshold || 7} />
            }
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-3 mb-2">
              <GateBadge passed={data.passed_gate} status={data.status} />
              {isLive && (
                <span className="font-mono text-xs text-accent-amber animate-pulse">
                  ● Analysis in progress…
                </span>
              )}
            </div>
            <h1 className="font-mono font-bold text-xl text-txt-primary mb-3 truncate">
              {data.commit_message || 'No commit message'}
            </h1>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5 font-mono text-xs text-txt-muted">
                <GitCommit size={12} />
                <code className="text-accent-blue">{data.commit_sha?.slice(0, 7)}</code>
                on <span className="text-txt-secondary">{data.branch}</span>
              </div>
              {data.author_login && (
                <div className="flex items-center gap-1.5 font-mono text-xs text-txt-muted">
                  <User size={12} />
                  <span>@{data.author_login}</span>
                </div>
              )}
              {data.pr_number && (
                <div className="flex items-center gap-1.5 font-mono text-xs text-accent-purple">
                  <GitPullRequest size={12} />
                  PR #{data.pr_number}
                </div>
              )}
              {data.created_at && (
                <div className="flex items-center gap-1.5 font-mono text-xs text-txt-muted">
                  <Calendar size={12} />
                  {new Date(data.created_at).toLocaleString()}
                </div>
              )}
              <span className={`font-mono text-xs capitalize px-2 py-0.5 rounded border border-bg-border ${
                data.trigger === 'push' ? 'text-accent-blue' :
                data.trigger === 'pr' ? 'text-accent-purple' : 'text-txt-muted'
              }`}>
                {data.trigger === 'push' ? '⚡ push' : data.trigger === 'pr' ? '⤵ pull request' : '▶ manual'}
              </span>
            </div>
          </div>
        </div>

        {/* Error state */}
        {data.status === 'error' && (
          <div className="card p-5 border-accent-red border-opacity-30 glow-red">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-accent-red" />
              <span className="font-mono text-sm font-bold text-accent-red">Analysis failed</span>
            </div>
            <code className="font-mono text-xs text-txt-secondary">{data.error_message}</code>
          </div>
        )}

        {!isLive && data.status === 'done' && (
          <>
            {/* Issue counts */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(ic)
                .filter(([k]) => k !== 'total')
                .map(([type, count]) => (
                  <IssueCountBadge key={type} type={type} count={count} />
                ))}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green bg-opacity-10 rounded border border-accent-green border-opacity-20">
                <span className="font-mono text-xs font-bold text-accent-green">{ic.total}</span>
                <span className="font-mono text-xs text-txt-muted">total issues</span>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Files analysed', value: summary.analysed_files, sub: `of ${summary.total_files}` },
                { label: 'Clean files', value: summary.clean_files, sub: 'no issues' },
                { label: 'Errors / fatals', value: (ic.error || 0) + (ic.fatal || 0), sub: 'must fix' },
                { label: 'Warnings', value: ic.warning || 0, sub: 'should fix' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="card p-4">
                  <div className="font-mono font-bold text-xl text-txt-primary">{value ?? '—'}</div>
                  <div className="font-mono text-xs text-txt-secondary mt-0.5">{label}</div>
                  <div className="font-mono text-xs text-txt-muted">{sub}</div>
                </div>
              ))}
            </div>

            {/* Most common issues */}
            {summary.most_common?.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={14} className="text-txt-muted" />
                  <h2 className="font-mono font-bold text-txt-primary text-sm">Most common issues</h2>
                </div>
                <div className="space-y-2">
                  {summary.most_common.map(({ symbol, count }) => (
                    <div key={symbol} className="flex items-center gap-3">
                      <code className="font-mono text-xs text-accent-blue w-48 flex-shrink-0">{symbol}</code>
                      <div className="flex-1 h-1.5 bg-bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-blue rounded-full"
                          style={{ width: `${Math.min(100, (count / (summary.most_common[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-txt-muted w-8 text-right">{count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File breakdown */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-border flex items-center gap-2">
                <FileCode size={14} className="text-txt-muted" />
                <h2 className="font-mono font-bold text-txt-primary text-sm">File breakdown</h2>
                <span className="font-mono text-xs text-txt-muted ml-auto">{files.length} files with issues</span>
              </div>
              {files.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="font-mono text-2xl mb-2">✓</div>
                  <p className="font-mono text-txt-secondary text-sm">No issues found — clean code!</p>
                </div>
              ) : (
                <div>
                  {files.map(f => (
                    <FileRow key={f.file} file={f} threshold={repo?.quality_threshold || 7} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Live state placeholder */}
        {isLive && (
          <div className="card p-10 text-center space-y-4">
            <Loader size={32} className="text-accent-green animate-spin mx-auto" />
            <div className="font-mono text-txt-secondary text-sm">
              {data.status === 'pending' ? 'Queued for analysis…' : 'Cloning repo and running Pylint…'}
            </div>
            <div className="font-mono text-xs text-txt-muted">Results will appear automatically</div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
