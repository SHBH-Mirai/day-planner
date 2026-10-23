import { useId } from 'react'
import { CATEGORIES, type Task } from '../domain/task'
import { summarize } from '../domain/summary'
import { CATEGORY_ICON, CATEGORY_LABEL } from './labels'
import { formatMinutes } from './neu/format'
import { NeuSurface } from './neu/NeuSurface'
import { dayTotals } from './neu/totals'

export function SummaryView({ tasks }: { tasks: Task[] }) {
  const legendId = useId()
  const { perTask, perCategory } = summarize(tasks)
  // Headline numbers and the bar share one rule with the focus strip, so the screens agree.
  const totals = dayTotals(tasks)
  const withTime = CATEGORIES.filter((c) => totals.perCategory[c] > 0)

  const stats: [string, string][] = [
    ['Planned', formatMinutes(totals.planned)],
    ['Actual', formatMinutes(totals.done)],
    ['Done', String(totals.doneCount)],
    ['Skipped', String(totals.skippedCount)],
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
          <div className="category-bar" role="img" aria-label="Time by category" aria-describedby={legendId}>
            {withTime.map((c) => (
              <span
                key={c}
                className="category-segment"
                data-category={c}
                aria-label={`${CATEGORY_LABEL[c]} ${totals.perCategory[c]} min`}
                style={{ flexGrow: totals.perCategory[c] }}
              />
            ))}
          </div>
          <p className="category-legend" id={legendId}>
            {withTime.map((c) => (
              <span key={c} data-category={c}>
                <span aria-hidden="true">{CATEGORY_ICON[c]} </span>
                {CATEGORY_LABEL[c]} {formatMinutes(totals.perCategory[c])}
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
