import { useId } from 'react'
import { MAX_DESCRIPTION } from '../domain/task'

const COUNT_FROM = 400

interface Props {
  value: string
  onChange: (value: string) => void
}

/** Optional plain-text description, with a character count once it gets long. */
export function DescriptionField({ value, onChange }: Props) {
  const countId = useId()
  const length = value.trim().length
  const over = length > MAX_DESCRIPTION
  return (
    <>
      <label className="form-wide">
        Description (optional)
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What to do, so the nudge makes sense"
          aria-describedby={countId}
        />
      </label>
      {/* Always rendered, so the row is there before the count appears and nothing shifts. */}
      <span id={countId} className={over ? 'form-count form-count-over' : 'form-count'}>
        {length >= COUNT_FROM ? `${length}/${MAX_DESCRIPTION}` : ''}
      </span>
    </>
  )
}
