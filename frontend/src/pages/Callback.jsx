import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { Loader, Shield } from 'lucide-react'

export default function Callback() {
  const [params] = useSearchParams()
  const { login } = useAuth()
  const navigate = useNavigate()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true
    const code = params.get('code')
    if (!code) { navigate('/login'); return }

    api.exchangeCode(code)
      .then(({ token, user }) => {
        login(token, user)
        navigate('/dashboard')
      })
      .catch(() => navigate('/login'))
  }, [])

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-accent-green bg-opacity-10 border border-accent-green border-opacity-30 rounded-xl flex items-center justify-center glow-green">
        <Shield size={22} className="text-accent-green" />
      </div>
      <div className="flex items-center gap-2 font-mono text-txt-secondary text-sm">
        <Loader size={14} className="animate-spin text-accent-green" />
        Authenticating with GitHub…
      </div>
    </div>
  )
}
