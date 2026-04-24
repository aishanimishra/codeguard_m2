import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('cg_token')
    if (!token) { setLoading(false); return }
    api.getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('cg_token'))
      .finally(() => setLoading(false))
  }, [])

  const login = (token, userData) => {
    localStorage.setItem('cg_token', token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('cg_token')
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
