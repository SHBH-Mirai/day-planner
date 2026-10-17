import { motion } from 'motion/react'

interface Props {
  done: number
  total: number
  size?: number
}

const STROKE = 6

/** A raised dial whose ring springs round to the share of tasks done. */
export function ProgressRing({ done, total, size = 76 }: Props) {
  const share = total > 0 ? Math.min(done / total, 1) : 0
  const r = size / 2 - STROKE - 4
  const length = 2 * Math.PI * r
  const c = size / 2

  return (
    <div className="ring neu-raised" role="img" aria-label={`${done} of ${total} done`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={c} cy={c} r={r} fill="none" strokeWidth={STROKE} />
        <motion.circle
          className="ring-fill"
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={length}
          initial={{ strokeDashoffset: length }}
          animate={{ strokeDashoffset: length * (1 - share) }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <span className="ring-label" aria-hidden="true">
        {Math.round(share * 100)}%
      </span>
    </div>
  )
}
