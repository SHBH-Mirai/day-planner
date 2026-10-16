import type { Task } from '../domain/task'
import { formatLocalTime } from '../domain/time'
import { CATEGORY_LABEL } from './labels'

interface Props {
  task: Task
  onStarted: () => void
  onDone: () => void
  onSkip: () => void
  onEdit: () => void
  onDelete: () => void
}

export function TaskCard({ task, onStarted, onDone, onSkip, onEdit, onDelete }: Props) {
  const planned = task.status === 'planned'

  function confirmDelete() {
    if (window.confirm(`Delete "${task.title}"?`)) onDelete()
  }

  return (
    <li>
      <article className="card" aria-label={task.title} data-category={task.category} data-status={task.status}>
        <div className="card-time">
          {formatLocalTime(task.start)}–{formatLocalTime(task.end)}
        </div>
        <div className="card-body">
          <h3>{task.title}</h3>
          <span className="tag">{CATEGORY_LABEL[task.category]}</span>
          {!planned && <span className="status">{task.status}</span>}
        </div>
        <div className="card-actions">
          {planned && !task.actualStart && <button onClick={onStarted}>Started</button>}
          {planned && (
            <button className="primary" onClick={onDone}>
              Done
            </button>
          )}
          {planned && <button onClick={onSkip}>Skip</button>}
          <button onClick={onEdit}>Edit</button>
          <button onClick={confirmDelete}>Delete</button>
        </div>
      </article>
    </li>
  )
}
