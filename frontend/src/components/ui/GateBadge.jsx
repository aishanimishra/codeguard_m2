import { CheckCircle, XCircle, Clock, Loader } from 'lucide-react'

export default function GateBadge({ passed, status, size = 'md' }) {
  const sm = size === 'sm'

  if (status === 'pending' || status === 'running') {
    return (
      <span className="badge-pending">
        <Loader size={sm ? 10 : 12} className="animate-spin" />
        {status === 'running' ? 'Analysing…' : 'Queued'}
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="badge-fail">
        <XCircle size={sm ? 10 : 12} />
        Error
      </span>
    )
  }
  if (passed) {
    return (
      <span className="badge-pass">
        <CheckCircle size={sm ? 10 : 12} />
        Gate passed
      </span>
    )
  }
  return (
    <span className="badge-fail">
      <XCircle size={sm ? 10 : 12} />
      Gate failed
    </span>
  )
}
