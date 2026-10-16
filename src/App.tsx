import { useState } from 'react'
import { InMemoryTaskRepository } from './storage/InMemoryTaskRepository'
import { TodayView } from './ui/TodayView'

// Task 12 picks the repository from VITE_STORAGE; in-memory until then.
const repo = new InMemoryTaskRepository()

function App() {
  // Fixed at page load. A tab left open past midnight keeps showing yesterday until refresh.
  const [day] = useState(() => new Date())
  return <TodayView repo={repo} day={day} />
}

export default App
