import { useState, type FormEvent } from 'react'
import { CATEGORIES, type Category, type Task, type TaskDraft } from '../domain/task'
import { validateTask } from '../domain/validate'
import { fromInputValue, toInputValue } from './datetimeInput'
import { CATEGORY_LABEL } from './labels'

const DEFAULT_LENGTH_MS = 30 * 60_000

interface Props {
  day: Date
  /** Other tasks on the day, for overlap warnings and the pre-filled slot. */
  others: Task[]
  /** Present when editing an existing task. */
  initial?: Task
  /** Resolves true when saved. The form keeps its values when it resolves false. */
  onSubmit: (draft: TaskDraft) => Promise<boolean>
  onCancel?: () => void
}

/** Next free slot: after the latest task, else 09:00 on the day. 30 minutes long. */
function nextSlot(day: Date, others: Task[]): { start: string; end: string } {
  const latestEnd = Math.max(...others.map((t) => Date.parse(t.end)))
  const start = Number.isFinite(latestEnd)
    ? new Date(latestEnd)
    : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0)
  return { start: start.toISOString(), end: new Date(start.getTime() + DEFAULT_LENGTH_MS).toISOString() }
}

export function TaskForm({ day, others, initial, onSubmit, onCancel }: Props) {
  // Until a time is typed, the new-task slot follows `others`, which may still be loading.
  // Typing either time pins both.
  const [typed, setTyped] = useState(initial ? { start: toInputValue(initial.start), end: toInputValue(initial.end) } : null)
  const slot = nextSlot(day, others)
  const { start, end } = typed ?? { start: toInputValue(slot.start), end: toInputValue(slot.end) }
  const setStart = (value: string) => setTyped({ start: value, end })
  const setEnd = (value: string) => setTyped({ start, end: value })
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState<Category>(initial?.category ?? 'office')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const draft: TaskDraft = { title, start: fromInputValue(start), end: fromInputValue(end), category }
  const { warnings } = validateTask(draft, others, initial?.id)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateTask(draft, others, initial?.id).errors
    if (!draft.start || !draft.end) found.push('Start and end are required')
    setErrors(found)
    if (found.length > 0) return
    setSaving(true)
    await onSubmit({ ...draft, title: title.trim() })
    setSaving(false)
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} aria-label={initial ? 'Edit task' : 'New task'}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Write proposal" />
      </label>
      <label>
        Start
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label>
        End
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      {errors.length > 0 && (
        <ul className="form-errors" role="alert">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="form-warnings">
          {warnings.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          {initial ? 'Save changes' : 'Add task'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
