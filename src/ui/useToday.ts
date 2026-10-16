import { useEffect, useState } from 'react'

/** Today's date, which rolls over after local midnight so a tab left open overnight moves on. */
export function useToday(checkMs = 60_000): Date {
  const [day, setDay] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => {
      setDay((current) => {
        const now = new Date()
        return now.toDateString() === current.toDateString() ? current : now
      })
    }, checkMs)
    return () => clearInterval(id)
  }, [checkMs])

  return day
}
