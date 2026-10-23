import { MAX_DESCRIPTION } from '../domain/task'

const COUNT_FROM = 400

interface Props {
  value: string
  onChange: (value: string) => void
}

/** Optional plain-text description, with a character count once it gets long. */
export function DescriptionField({ value, onChange }: Props) {
  const length = value.trim().length
  return (
    <>
      <label className="form-wide">
        Description (optional)
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder="What to do, so the nudge makes sense" />
      </label>
      {length >= COUNT_FROM && (
        <span className="form-count" aria-live="polite">
          {length}/{MAX_DESCRIPTION}
        </span>
      )}
    </>
  )
}
