import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  Shield, LayoutDashboard, GitBranch, Plus, LogOut, Upload
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/repos',     icon: GitBranch,       label: 'Repositories' },
  { to: '/add-repo',  icon: Plus,            label: 'Add Repo' },
  { to: '/analyse',   icon: Upload,          label: 'Analyse File', public: true },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-bg-surface border-r border-bg-border flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent-green bg-opacity-10 border border-accent-green border-opacity-30 rounded flex items-center justify-center">
            <Shield size={16} className="text-accent-green" />
          </div>
          <div>
            <div className="font-mono font-bold text-txt-primary text-sm tracking-wide">CodeGuard</div>
            <div className="font-mono text-txt-muted text-xs">quality gate</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-mono transition-all duration-150 ${
                isActive
                  ? 'bg-accent-green bg-opacity-10 text-accent-green border border-accent-green border-opacity-20'
                  : 'text-txt-secondary hover:text-txt-primary hover:bg-bg-hover'
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 py-4 border-t border-bg-border space-y-1">
          <div className="flex items-center gap-3 px-3 py-2">
            <img
              src={user.avatar_url}
              alt={user.login}
              className="w-7 h-7 rounded-full border border-bg-border"
            />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-txt-primary truncate">@{user.login}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded text-sm font-mono text-txt-muted hover:text-accent-red hover:bg-bg-hover transition-all duration-150"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
