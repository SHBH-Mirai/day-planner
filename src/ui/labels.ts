import type { Category } from '../domain/task'

export const CATEGORY_LABEL: Record<Category, string> = {
  office: 'Office',
  projects: 'Projects',
  youtube: 'Content',
  recording: 'Recording',
  editing: 'Editing',
  learning: 'Learning',
  health: 'Health',
  personal: 'Personal',
  breaks: 'Breaks & meals',
}

export const CATEGORY_ICON: Record<Category, string> = {
  office: '💼',
  projects: '✍️',
  youtube: '🎬',
  recording: '🎙️',
  editing: '✂️',
  learning: '📚',
  health: '💪',
  personal: '🏠',
  breaks: '🍽️',
}
