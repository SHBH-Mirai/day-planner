import { useId } from 'react'
import { progressRange, STREAK_LOOKBACK_DAYS, streaks, weekReview } from '../domain/progress'
import { CATEGORIES, type Task } from '../domain/task'
import type { TaskRepository } from '../storage/TaskRepository'
import { CATEGORY_ICON, CATEGORY_LABEL } from './labels'
import { formatMinutes } from './neu/format'
import { NeuSurface } from './neu/NeuSurface'
import { useTaskRange } from './useTaskRange'

const shortDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const shortDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const longDay = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
/** Bars never scale to less than 2h, so one short day doesn't look like a full one. */
const MIN_SCALE_MIN = 120

/** "+1h vs same time last week", "−20m vs …", "Same as this time last week"; nothing in a first week. */
function versusLastWeek(doneMin: number, lastWeekDoneMin: number): string {
  if (lastWeekDoneMin === 0) return ''
  const diff = doneMin - lastWeekDoneMin
  if (diff === 0) return 'Same as this time last week'
  return `${diff > 0 ? '+' : '−'}${formatMinutes(Math.abs(diff))} vs same time last week`
}

interface Props {
  repo: TaskRepository
  now: Date
  /** Days the screen already holds (Today, Tomorrow): their tasks replace the loaded ones, so edits show at once. */
  live?: { day: Date; tasks: Task[] }[]
}

/** This week at a glance (Monday to Sunday) and the streaks that keep it going. */
export function WeekView({ repo, now, live = [] }: Props) {
  const legendId = useId()
  const range = progressRange(now)
  const { tasks: loaded, failed, retry } = useTaskRange(repo, range.from, range.days)

  if (failed) {
    return (
      <section className="week" aria-label="Week">
        <div className="banner banner-warning" role="alert">
          Couldn't load your week. <button onClick={retry}>Retry</button>
        </div>
      </section>
    )
  }
  if (!loaded) {
    return (
      <section className="week" aria-label="Week">
        <p className="muted" role="status">
          Loading your week…
        </p>
      </section>
    )
  }

  const liveDays = live.filter((l) => l.tasks.length > 0)
  const liveKeys = new Set(liveDays.map((l) => l.day.toDateString()))
  const tasks = [...loaded.filter((t) => !liveKeys.has(new Date(t.start).toDateString())), ...liveDays.flatMap((l) => l.tasks)]

  const review = weekReview(tasks, now)
  const streak = streaks(tasks, now)
  const scale = Math.max(MIN_SCALE_MIN, ...review.days.map((d) => Math.max(d.doneMin, d.future ? d.plannedMin : 0)))
  const withTime = CATEGORIES.filter((c) => review.perCategoryDone[c] > 0).sort((a, b) => review.perCategoryDone[b] - review.perCategoryDone[a])
  const versus = versusLastWeek(review.doneMin, review.lastWeekDoneMin)
  const todayKey = now.toDateString()
  const pct = (min: number) => `${Math.round((min / scale) * 100)}%`

  return (
    <section className="week" aria-label="Week">
      <h2>This week</h2>
      <p className="muted week-range">
        {shortDate.format(review.start)} – {shortDate.format(review.days[6].day)}
      </p>

      <div className="summary-stats week-stats" role="group" aria-label="Week totals">
        <NeuSurface className="stat stat-headline">
          <span>Focus</span>
          <strong>{formatMinutes(review.doneMin)}</strong>
          <small>
            {review.doneCount} done · {review.skippedCount} skipped
          </small>
          {versus && <small>{versus}</small>}
        </NeuSurface>
      </div>

      <NeuSurface variant="inset" className="week-days-wrap">
        <ol className="week-days" aria-label="Focus by day">
          {review.days.map((d) => {
            const isToday = d.day.toDateString() === todayKey
            const name = `${longDay.format(d.day)}${isToday ? ', today' : ''}`
            return (
              <li
                key={d.day.toDateString()}
                aria-current={isToday ? 'date' : undefined}
                data-today={isToday ? 'true' : undefined}
                data-future={d.future ? 'true' : undefined}
                data-empty={!d.future && d.doneMin === 0 ? 'true' : undefined}
              >
                <span className="visually-hidden">{`${name}: ${formatMinutes(d.doneMin)} done of ${formatMinutes(d.plannedMin)} planned`}</span>
                <span className="week-bar-track" aria-hidden="true">
                  <span className="week-bar" style={{ height: pct(d.future ? d.plannedMin : d.doneMin) }} />
                </span>
                <span className="week-day-min" aria-hidden="true">
                  {!d.future && d.doneMin > 0 ? formatMinutes(d.doneMin) : ''}
                </span>
                <span className="week-day-label" aria-hidden="true">
                  {shortDay.format(d.day)}
                </span>
              </li>
            )
          })}
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
        {streak.days > 0 ? (
          <p className="streak-main">
            <span aria-hidden="true">🔥 </span>
            <span>{streak.capped ? `${streak.days}+ days in a row` : `${streak.days}-day streak`}</span>
          </p>
        ) : (
          <p className="streak-empty">A new streak starts with your next finished task.</p>
        )}
        {streak.days > 0 && !streak.todayDone && <p className="streak-hint">Finish one today to keep it going.</p>}
        {streak.byCategory.length > 0 && (
          <ul className="streak-chips" aria-label="Category streaks">
            {streak.byCategory.map(({ category, days }) => (
              <li key={category} data-category={category}>
                <span aria-hidden="true">{CATEGORY_ICON[category]} </span>
                {`${CATEGORY_LABEL[category]} · ${days}${days >= STREAK_LOOKBACK_DAYS ? '+' : ''} days`}
              </li>
            ))}
          </ul>
        )}
      </NeuSurface>
    </section>
  )
}
