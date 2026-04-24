import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ScoreRing from '../components/ui/ScoreRing'
import {
  Upload, FileCode, AlertCircle, AlertTriangle, Info, Wrench,
  Zap, ChevronDown, ChevronRight, Download, RotateCcw, Clipboard,
  CheckCircle, Loader, X, Github
} from 'lucide-react'

// ── Severity config (same as AnalysisDetail) ─────────────────────────────────
const SEVERITY = {
  fatal:      { color: 'text-accent-red',    border: 'border-l-2 border-accent-red',    icon: AlertCircle,   label: 'Fatal'      },
  error:      { color: 'text-accent-red',    border: 'border-l-2 border-accent-red',    icon: AlertCircle,   label: 'Error'      },
  warning:    { color: 'text-accent-amber',  border: 'border-l-2 border-accent-amber',  icon: AlertTriangle, label: 'Warning'    },
  refactor:   { color: 'text-accent-purple', border: 'border-l-2 border-accent-purple', icon: Wrench,        label: 'Refactor'   },
  convention: { color: 'text-accent-blue',   border: 'border-l-2 border-accent-blue',   icon: Info,          label: 'Convention' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function FileRow({ file }) {
  const [open, setOpen] = useState(file.error_count > 0)
  return (
    <div className="border-b border-bg-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bg-raised transition-colors text-left"
      >
        {open
          ? <ChevronDown size={13} className="text-txt-muted flex-shrink-0" />
          : <ChevronRight size={13} className="text-txt-muted flex-shrink-0" />}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UploadAnalyser() {
  const [tab, setTab] = useState('upload')      // 'upload' | 'paste'
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [pasteCode, setPasteCode] = useState('')
  const [pasteFilename, setPasteFilename] = useState('snippet.py')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)

  // ── Drag & drop handlers ───────────────────────────────────────────────────
  const onDragOver = useCallback((e) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) pickFile(file)
  }, [])

  function pickFile(file) {
    if (!file.name.endsWith('.py')) {
      setError('Only .py files are supported')
      return
    }
    setError(null)
    setSelectedFile(file)
    setResult(null)
  }

  // ── Submit handlers ────────────────────────────────────────────────────────
  async function analyseFile() {
    if (!selectedFile) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await fetch('/api/upload/file', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(err.detail || 'Upload failed')
      }
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function analysePaste() {
    if (!pasteCode.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('code', pasteCode)
      fd.append('filename', pasteFilename || 'snippet.py')
      const res = await fetch('/api/upload/paste', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Analysis failed' }))
        throw new Error(err.detail || 'Analysis failed')
      }
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── PDF download ───────────────────────────────────────────────────────────
  async function downloadPdf() {
    if (!result) return
    setPdfLoading(true)
    try {
      const res = await fetch('/api/upload/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `codeguard-${result.filename || 'report'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(`PDF error: ${e.message}`)
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Copy result ID ─────────────────────────────────────────────────────────
  function copyResultId() {
    if (!result?.result_id) return
    navigator.clipboard.writeText(result.result_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setResult(null)
    setError(null)
    setSelectedFile(null)
    setPasteCode('')
  }

  // ── Result section ─────────────────────────────────────────────────────────
  const ic      = result?.issue_counts || {}
  const summary = result?.summary || {}
  const files   = result?.file_results || []

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Top nav ── */}
      <header className="border-b border-bg-border px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-mono font-bold text-accent-green text-lg tracking-tight">⬡ CodeGuard</span>
          <span className="font-mono text-xs text-txt-muted group-hover:text-txt-secondary transition-colors">← home</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-txt-muted hidden sm:block">Want repo integration?</span>
          <Link to="/" className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
            <Github size={12} />
            Sign in with GitHub
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">

        {/* ── Hero ── */}
        <div className="text-center space-y-2">
          <h1 className="font-mono font-bold text-2xl text-txt-primary">
            Instant Python Analyser
          </h1>
          <p className="font-mono text-sm text-txt-muted">
            Upload a <code className="text-accent-blue">.py</code> file or paste your code — get a Pylint score in seconds. No account needed.
          </p>
        </div>

        {/* ── Input card ── */}
        {!result && (
          <div className="card overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-bg-border">
              {[
                { id: 'upload', label: '↑ Upload file' },
                { id: 'paste',  label: '⌨ Paste code' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 font-mono text-xs py-3 transition-colors ${
                    tab === t.id
                      ? 'text-accent-green border-b-2 border-accent-green bg-bg-raised'
                      : 'text-txt-muted hover:text-txt-secondary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {tab === 'upload' ? (
                <>
                  {/* Drop zone */}
                  <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3
                      cursor-pointer transition-all select-none
                      ${dragging
                        ? 'border-accent-green bg-accent-green bg-opacity-5'
                        : selectedFile
                          ? 'border-accent-blue bg-accent-blue bg-opacity-5'
                          : 'border-bg-border hover:border-txt-muted'}
                    `}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".py"
                      className="hidden"
                      onChange={e => { if (e.target.files[0]) pickFile(e.target.files[0]) }}
                    />
                    {selectedFile ? (
                      <>
                        <FileCode size={28} className="text-accent-blue" />
                        <div className="text-center">
                          <p className="font-mono text-sm text-txt-primary">{selectedFile.name}</p>
                          <p className="font-mono text-xs text-txt-muted mt-0.5">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedFile(null) }}
                          className="font-mono text-xs text-txt-muted hover:text-accent-red flex items-center gap-1"
                        >
                          <X size={11} /> remove
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload size={28} className="text-txt-muted" />
                        <div className="text-center">
                          <p className="font-mono text-sm text-txt-secondary">
                            Drag & drop a <span className="text-accent-blue">.py</span> file here
                          </p>
                          <p className="font-mono text-xs text-txt-muted mt-1">or click to browse</p>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={analyseFile}
                    disabled={!selectedFile || loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
                    {loading ? 'Analysing…' : 'Analyse file'}
                  </button>
                </>
              ) : (
                <>
                  {/* Filename input */}
                  <div className="flex gap-3 items-center">
                    <label className="font-mono text-xs text-txt-muted flex-shrink-0">Filename:</label>
                    <input
                      type="text"
                      value={pasteFilename}
                      onChange={e => setPasteFilename(e.target.value)}
                      placeholder="snippet.py"
                      className="flex-1 font-mono text-xs bg-bg-raised border border-bg-border rounded px-3 py-1.5 text-txt-primary focus:outline-none focus:border-accent-blue"
                    />
                  </div>

                  {/* Code textarea */}
                  <textarea
                    value={pasteCode}
                    onChange={e => setPasteCode(e.target.value)}
                    placeholder={"# Paste your Python code here\ndef hello():\n    print('Hello, world!')"}
                    rows={14}
                    spellCheck={false}
                    className="w-full font-mono text-xs bg-bg-raised border border-bg-border rounded px-4 py-3 text-txt-primary focus:outline-none focus:border-accent-blue resize-y leading-relaxed"
                  />

                  <button
                    onClick={analysePaste}
                    disabled={!pasteCode.trim() || loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
                    {loading ? 'Analysing…' : 'Analyse code'}
                  </button>
                </>
              )}

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 bg-accent-red bg-opacity-10 border border-accent-red border-opacity-30 rounded font-mono text-xs text-accent-red">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="space-y-6 animate-fade-in">

            {/* Result header */}
            <div className="flex items-center justify-between">
              <h2 className="font-mono font-bold text-txt-primary text-sm">Results</h2>
              <div className="flex items-center gap-2">
                {/* Copy result ID */}
                <button
                  onClick={copyResultId}
                  title="Copy result ID (shareable)"
                  className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  {copied ? <CheckCircle size={12} className="text-accent-green" /> : <Clipboard size={12} />}
                  {copied ? 'Copied!' : 'Copy ID'}
                </button>

                {/* Download PDF */}
                <button
                  onClick={downloadPdf}
                  disabled={pdfLoading}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {pdfLoading ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                  {pdfLoading ? 'Generating…' : 'Download PDF'}
                </button>

                {/* Reset */}
                <button onClick={reset} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <RotateCcw size={12} />
                  New analysis
                </button>
              </div>
            </div>

            {/* Score + meta */}
            <div className="card p-6 flex items-center gap-8">
              <ScoreRing score={result.quality_score} size={112} threshold={7} />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {result.quality_score >= 7
                    ? <span className="badge-pass"><CheckCircle size={11} /> Gate passed</span>
                    : <span className="badge-fail"><AlertCircle size={11} /> Gate failed</span>
                  }
                  <span className="font-mono text-xs text-txt-muted">threshold 7.0 / 10</span>
                </div>
                <p className="font-mono text-xs text-txt-muted">
                  <span className="text-txt-secondary">{result.filename}</span>
                  {' '}•{' '}{result.duration_ms?.toFixed(0)} ms
                  {' '}•{' '}{result.analysed_at?.slice(0, 19).replace('T', ' ')} UTC
                </p>
                {result.s3_key && (
                  <p className="font-mono text-xs text-accent-blue">
                    ☁ Stored in S3: <code className="text-txt-muted">{result.s3_key}</code>
                  </p>
                )}
              </div>
            </div>

            {/* Issue counts */}
            <div className="flex flex-wrap gap-2">
              {['fatal', 'error', 'warning', 'refactor', 'convention'].map(type => (
                <IssueCountBadge key={type} type={type} count={ic[type] || 0} />
              ))}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green bg-opacity-10 rounded border border-accent-green border-opacity-20">
                <span className="font-mono text-xs font-bold text-accent-green">{ic.total || 0}</span>
                <span className="font-mono text-xs text-txt-muted">total</span>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Files analysed', value: summary.analysed_files, sub: `of ${summary.total_files}` },
                { label: 'Clean files',    value: summary.clean_files,    sub: 'no issues' },
                { label: 'Errors / fatals', value: (ic.error || 0) + (ic.fatal || 0), sub: 'must fix' },
                { label: 'Warnings',       value: ic.warning || 0,       sub: 'should fix' },
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
                files.map(f => <FileRow key={f.file} file={f} />)
              )}
            </div>

            {/* PDF CTA bottom */}
            <div className="card p-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-txt-primary font-bold">Export full report</p>
                <p className="font-mono text-xs text-txt-muted mt-0.5">
                  Download a formatted PDF with all issues, scores, and file breakdowns
                </p>
              </div>
              <button
                onClick={downloadPdf}
                disabled={pdfLoading}
                className="btn-primary flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
              >
                {pdfLoading ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                {pdfLoading ? 'Generating…' : 'Download PDF'}
              </button>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <p className="font-mono text-xs text-txt-muted text-center pb-4">
          Powered by Pylint · Results stored in AWS S3 · Metrics in CloudWatch
        </p>
      </main>
    </div>
  )
}
