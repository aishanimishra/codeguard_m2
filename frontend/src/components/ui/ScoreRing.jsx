export default function ScoreRing({ score, size = 120, threshold = 7.0 }) {
  const radius = (size - 16) / 2
  const circ = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(10, score)) / 10
  const dash = pct * circ

  const color =
    score >= threshold ? '#00e676' :
    score >= threshold * 0.7 ? '#ffab00' : '#ff4444'

  const glow =
    score >= threshold ? 'drop-shadow(0 0 8px rgba(0,230,118,0.5))' :
    score >= threshold * 0.7 ? 'drop-shadow(0 0 8px rgba(255,171,0,0.5))' :
    'drop-shadow(0 0 8px rgba(255,68,68,0.5))'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#1f252e" strokeWidth="6"
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ filter: glow, transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono font-bold text-txt-primary" style={{ fontSize: size * 0.22 }}>
          {score.toFixed(1)}
        </span>
        <span className="font-mono text-txt-muted" style={{ fontSize: size * 0.11 }}>/10</span>
      </div>
    </div>
  )
}
