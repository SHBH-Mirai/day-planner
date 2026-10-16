import { CATEGORIES, type Task } from '../domain/task'
import { summarize } from '../domain/summary'
import { CATEGORY_LABEL } from './labels'

export function SummaryView({ tasks }: { tasks: Task[] }) {
  const { perTask, perCategory } = summarize(tasks)

  return (
    <section className="summary" aria-label="Summary">
      <h2>End of day</h2>
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
    </section>
  )
}
