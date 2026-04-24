import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Shield, Github, Zap, Lock, BarChart2, Upload, FileCode, ArrowRight } from 'lucide-react'

const GITHUB_FEATURES = [
  { icon: Zap,       label: 'Auto-analysis on every push' },
  { icon: Lock,      label: 'Quality gate blocks bad merges' },
  { icon: BarChart2, label: 'Score trends across commits' },
]

const UPLOAD_FEATURES = [
  { icon: Upload,   label: 'Drag & drop any .py file' },
  { icon: FileCode, label: 'Or paste code directly' },
  { icon: Zap,      label: 'Instant Pylint score + PDF report' },
]

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user])

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center relative overflow-hidden px-4 py-12">

      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#00e676 1px, transparent 1px), linear-gradient(90deg, #00e676 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      {/* Glow orbs */}
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-accent-green opacity-[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-accent-blue opacity-[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-3xl animate-fade-in">

        {/* ── Logo ── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-green bg-opacity-10 border border-accent-green border-opacity-30 rounded-xl mb-5 glow-green">
            <Shield size={28} className="text-accent-green" />
          </div>
          <h1 className="font-mono font-bold text-4xl text-txt-primary tracking-tight">CodeGuard</h1>
          <p className="font-mono text-txt-secondary text-sm mt-2">
            <span className="text-accent-green">$</span> Python code quality — your way
          </p>
        </div>

        {/* ── Two path cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* ── Path 1: GitHub / Full dashboard ── */}
          <div className="card p-7 flex flex-col gap-5 hover:border-accent-green hover:border-opacity-40 transition-colors duration-200">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Github size={16} className="text-txt-primary" />
                <span className="font-mono font-bold text-txt-primary text-sm">Connect GitHub</span>
                <span className="font-mono text-xs bg-accent-green bg-opacity-10 text-accent-green border border-accent-green border-opacity-20 px-2 py-0.5 rounded ml-auto">Full access</span>
              </div>
              <p className="font-mono text-xs text-txt-muted leading-relaxed">
                Link your repos and get automatic quality gates on every push.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2.5 flex-1">
              {GITHUB_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 bg-accent-green bg-opacity-10 rounded flex items-center justify-center flex-shrink-0">
                    <Icon size={12} className="text-accent-green" />
                  </div>
                  <span className="font-mono text-xs text-txt-secondary">{label}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-bg-border" />

            {/* CTA */}
            <button
              onClick={() => { window.location.href = '/api/auth/login' }}
              className="w-full flex items-center justify-center gap-2.5 bg-txt-primary text-bg-base font-mono font-bold text-sm py-3 rounded hover:bg-opacity-90 transition-all duration-150 active:scale-95"
            >
              <Github size={16} />
              Continue with GitHub
            </button>
            <p className="font-mono text-xs text-txt-muted text-center -mt-2">
              Needs <code className="text-accent-blue">repo</code> + <code className="text-accent-blue">read:user</code> scopes
            </p>
          </div>

          {/* ── Path 2: Upload analyser / No login ── */}
          <div className="card p-7 flex flex-col gap-5 hover:border-accent-blue hover:border-opacity-40 transition-colors duration-200">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Upload size={16} className="text-accent-blue" />
                <span className="font-mono font-bold text-txt-primary text-sm">Quick Analyse</span>
                <span className="font-mono text-xs bg-accent-blue bg-opacity-10 text-accent-blue border border-accent-blue border-opacity-20 px-2 py-0.5 rounded ml-auto">No login</span>
              </div>
              <p className="font-mono text-xs text-txt-muted leading-relaxed">
                Upload a file or paste code and get your Pylint score instantly.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2.5 flex-1">
              {UPLOAD_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 bg-accent-blue bg-opacity-10 rounded flex items-center justify-center flex-shrink-0">
                    <Icon size={12} className="text-accent-blue" />
                  </div>
                  <span className="font-mono text-xs text-txt-secondary">{label}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-bg-border" />

            {/* CTA */}
            <Link
              to="/analyse"
              className="w-full flex items-center justify-center gap-2.5 bg-accent-blue bg-opacity-10 border border-accent-blue border-opacity-30 text-accent-blue font-mono font-bold text-sm py-3 rounded hover:bg-opacity-20 transition-all duration-150 active:scale-95"
            >
              <FileCode size={16} />
              Analyse a file now
              <ArrowRight size={14} className="ml-auto" />
            </Link>
            <p className="font-mono text-xs text-txt-muted text-center -mt-2">
              No account needed · results in seconds
            </p>
          </div>

        </div>

        {/* ── Footer ── */}
        <p className="text-center font-mono text-xs text-txt-muted mt-8">
          Self-hosted · Your code never leaves your server
        </p>
      </div>
    </div>
  )
}
