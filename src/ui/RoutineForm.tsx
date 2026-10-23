import { useState, type FormEvent } from 'react'
import { validateRoutine, WEEKDAYS, type Routine, type RoutineDraft, type Weekday } from '../domain/routine'
import { CATEGORIES, normaliseDescription, type Category } from '../domain/task'
import { CATEGORY_LABEL } from './labels'
import { DescriptionField } from './DescriptionField'

interface Props {
  /** Present when editing an existing routine. */
  initial?: Routine
  /** Resolves true when saved. */
  onSubmit: (draft: RoutineDraft) => Promise<boolean>
  onCancel: () => void
}

/** Title, category, start time, length and days for a routine. */
export function RoutineForm({ initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState<Category>(initial?.category ?? 'office')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [startTime, setStartTime] = useState(initial?.startTime ?? '07:00')
  const [durationMin, setDurationMin] = useState(String(initial?.durationMin ?? 30))
  const [days, setDays] = useState<Weekday[]>(initial?.days ?? [])
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const toggleDay = (d: Weekday) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : WEEKDAYS.filter((x) => x === d || ds.includes(x))))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // `description` is always present, even when empty, so an edit that clears it overwrites the old one.
    const draft: RoutineDraft = {
      title: title.trim(),
      category,
      startTime,
      durationMin: Number(durationMin),
      days,
      active: initial?.active ?? true,
      description: normaliseDescription(description),
    }
    const problems = validateRoutine(draft)
    setErrors(problems)
    if (problems.length > 0) return
    setSaving(true)
    await onSubmit(draft)
    setSaving(false)
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} aria-label={initial ? 'Edit routine' : 'New routine'}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gym" />
      </label>
      <label>
        Start time
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </label>
      <label>
        Length (min)
        <input type="number" min={5} max={720} step={1} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
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
      <div className="routine-days" role="group" aria-label="Days">
        {WEEKDAYS.map((d) => (
          <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>
            {d}
          </button>
        ))}
      </div>
      <DescriptionField value={description} onChange={setDescription} />

      {errors.length > 0 && (
        <ul className="form-errors" role="alert">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          Save routine
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
