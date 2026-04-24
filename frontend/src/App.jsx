import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Callback from './pages/Callback'
import Dashboard from './pages/Dashboard'
import Repos from './pages/Repos'
import RepoDetail from './pages/RepoDetail'
import AddRepo from './pages/AddRepo'
import AnalysisDetail from './pages/AnalysisDetail'
import UploadAnalyser from './pages/UploadAnalyser'
import { Loader } from 'lucide-react'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <Loader size={20} className="animate-spin text-accent-green" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<Callback />} />
      <Route path="/analyse" element={<UploadAnalyser />} />
      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/repos" element={<ProtectedRoute><Repos /></ProtectedRoute>} />
      <Route path="/repos/:repoId" element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />
      <Route path="/add-repo" element={<ProtectedRoute><AddRepo /></ProtectedRoute>} />
      <Route path="/analysis/:analysisId" element={<ProtectedRoute><AnalysisDetail /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
