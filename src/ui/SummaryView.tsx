import { CATEGORIES, type Task } from '../domain/task'
import { summarize } from '../domain/summary'
import { CATEGORY_LABEL } from './labels'
import { formatMinutes } from './neu/format'
import { NeuSurface } from './neu/NeuSurface'

export function SummaryView({ tasks }: { tasks: Task[] }) {
  const { perTask, perCategory } = summarize(tasks)
  const planned = perTask.reduce((sum, t) => sum + (t.status === 'skipped' ? 0 : t.plannedMin), 0)
  const actual = perTask.reduce((sum, t) => sum + (t.actualMin ?? 0), 0)
  const done = perTask.filter((t) => t.status === 'done').length
  const skipped = perTask.filter((t) => t.status === 'skipped').length
  const withTime = CATEGORIES.filter((c) => perCategory[c] > 0)

  const stats: [string, string][] = [
    ['Planned', formatMinutes(planned)],
    ['Actual', formatMinutes(actual)],
    ['Done', String(done)],
    ['Skipped', String(skipped)],
  ]

  return (
    <section className="summary" aria-label="Summary">
      <h2>End of day</h2>

      <div className="summary-stats" role="group" aria-label="Day totals">
        {stats.map(([label, value]) => (
          <NeuSurface key={label} className="stat">
            <span>{label}</span>
            <strong>{value}</strong>
          </NeuSurface>
        ))}
      </div>

      {withTime.length > 0 && (
        <NeuSurface variant="inset" className="category-bar-wrap">
          <div className="category-bar" role="img" aria-label="Time by category">
            {withTime.map((c) => (
              <span
                key={c}
                className="category-segment"
                data-category={c}
                aria-label={`${CATEGORY_LABEL[c]} ${perCategory[c]} min`}
                style={{ flexGrow: perCategory[c] }}
              />
            ))}
          </div>
          <p className="category-legend">
            {withTime.map((c) => (
              <span key={c} data-category={c}>
                {CATEGORY_LABEL[c]} {formatMinutes(perCategory[c])}
              </span>
            ))}
          </p>
        </NeuSurface>
      )}

      <NeuSurface className="summary-tables">
        <table aria-label="Tasks">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Planned (min)</th>
              <th scope="col">Actual (min)</th>
            </tr>
          </thead>
          <tbody>
            {perTask.map((t) => (
              <tr key={t.id} data-status={t.status}>
                <th scope="row">{t.title}</th>
                <td>{t.plannedMin}</td>
                <td>{t.actualMin ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table aria-label="By category">
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c} data-category={c}>
                <th scope="row">{CATEGORY_LABEL[c]}</th>
                <td>{perCategory[c]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </NeuSurface>
    </section>
  )
}
