import { useId } from 'react'
import { STREAK_LOOKBACK_DAYS, streaks, weekReview } from '../domain/progress'
import { CATEGORIES } from '../domain/task'
import type { TaskRepository } from '../storage/TaskRepository'
import { CATEGORY_ICON, CATEGORY_LABEL } from './labels'
import { formatMinutes } from './neu/format'
import { NeuSurface } from './neu/NeuSurface'
import { useTaskRange } from './useTaskRange'

const shortDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const shortDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const longDay = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })

/** "+1h vs last week", "−20m vs last week" or "Same as last week". */
function versusLastWeek(doneMin: number, lastWeekDoneMin: number): string {
  const diff = doneMin - lastWeekDoneMin
  if (diff === 0) return 'Same as last week'
  return `${diff > 0 ? '+' : '−'}${formatMinutes(Math.abs(diff))} vs last week`
}

/** This week at a glance (Monday to Sunday) and the streaks that keep it going. */
export function WeekView({ repo, today }: { repo: TaskRepository; today: Date }) {
  const legendId = useId()
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (STREAK_LOOKBACK_DAYS - 1))
  const { tasks, failed, retry } = useTaskRange(repo, from, STREAK_LOOKBACK_DAYS)

  if (failed) {
    return (
      <section className="week" aria-label="Week">
        <div className="banner banner-warning" role="alert">
          Couldn't load your week.{' '}
          <button onClick={() => void retry()}>Retry</button>
        </div>
      </section>
    )
  }
  if (!tasks) {
    return (
      <section className="week" aria-label="Week">
        <p className="muted">Loading your week…</p>
      </section>
    )
  }

  const review = weekReview(tasks, today)
  const streak = streaks(tasks, today)
  const sunday = review.days[6].day
  const best = Math.max(1, ...review.days.map((d) => d.doneMin))
  const withTime = CATEGORIES.filter((c) => review.perCategoryDone[c] > 0)
  const count = (days: number) => `${days}${days >= STREAK_LOOKBACK_DAYS ? '+' : ''}`

  return (
    <section className="week" aria-label="Week">
      <h2>This week</h2>
      <p className="muted week-range">
        {shortDate.format(review.start)} – {shortDate.format(sunday)}
      </p>

      <div className="summary-stats" role="group" aria-label="Week totals">
        <NeuSurface className="stat">
          <span>Focus</span>
          <strong>{formatMinutes(review.doneMin)}</strong>
          <small>{versusLastWeek(review.doneMin, review.lastWeekDoneMin)}</small>
        </NeuSurface>
        <NeuSurface className="stat">
          <span>Done</span>
          <strong>{review.doneCount}</strong>
        </NeuSurface>
        <NeuSurface className="stat">
          <span>Skipped</span>
          <strong>{review.skippedCount}</strong>
        </NeuSurface>
      </div>

      <NeuSurface variant="inset" className="week-days-wrap">
        <ol className="week-days" aria-label="Focus by day">
          {review.days.map((d) => (
            <li
              key={d.day.toDateString()}
              aria-label={`${longDay.format(d.day)}: ${formatMinutes(d.doneMin)} done of ${formatMinutes(d.plannedMin)} planned`}
              data-today={d.day.toDateString() === today.toDateString() ? 'true' : undefined}
              data-future={d.future ? 'true' : undefined}
            >
              <span className="week-bar-track" aria-hidden="true">
                <span className="week-bar" style={{ height: `${Math.round((d.doneMin / best) * 100)}%` }} />
              </span>
              <span className="week-day-min" aria-hidden="true">
                {d.doneMin > 0 ? formatMinutes(d.doneMin) : '–'}
              </span>
              <span className="week-day-label" aria-hidden="true">
                {shortDay.format(d.day)}
              </span>
            </li>
          ))}
        </ol>
      </NeuSurface>

      {withTime.length > 0 && (
        <NeuSurface variant="inset" className="category-bar-wrap">
          <div className="category-bar" role="img" aria-label="Time by category this week" aria-describedby={legendId}>
            {withTime.map((c) => (
              <span
                key={c}
                className="category-segment"
                data-category={c}
                aria-label={`${CATEGORY_LABEL[c]} ${review.perCategoryDone[c]} min`}
                style={{ flexGrow: review.perCategoryDone[c] }}
              />
            ))}
          </div>
          <p className="category-legend" id={legendId}>
            {withTime.map((c) => (
              <span key={c} data-category={c}>
                <span aria-hidden="true">{CATEGORY_ICON[c]} </span>
                {CATEGORY_LABEL[c]} {formatMinutes(review.perCategoryDone[c])}
              </span>
            ))}
          </p>
        </NeuSurface>
      )}

      <NeuSurface className="streaks">
        <p className="streak-main">
          {streak.days > 0 ? `🔥 ${count(streak.days)}-day streak` : 'No streak yet. Tick a task done today to start one.'}
        </p>
        {streak.byCategory.length > 0 && (
          <ul className="streak-chips" aria-label="Category streaks">
            {streak.byCategory.map(({ category, days }) => (
              <li key={category} data-category={category}>
                {`${CATEGORY_ICON[category]} ${CATEGORY_LABEL[category]} · ${count(days)} days`}
              </li>
            ))}
          </ul>
        )}
      </NeuSurface>
    </section>
  )
}
