import { describe, expect, test } from 'vitest'
import { CATEGORIES } from '../domain/task'
import css from './theme.css?raw'

/** The variables block that starts with `selector {`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`no block for ${selector}`)
  return css.slice(start, css.indexOf('\n}', start))
}

function cssVar(scope: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(scope)?.[1]
}

/** WCAG 2 contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const themes = {
  light: block("[data-theme='light']"),
  dark: block("[data-theme='dark']"),
  contrast: block("[data-theme='contrast']"),
}

describe('category colours', () => {
  test('every category has a colour in the light, dark and contrast themes', () => {
    for (const c of CATEGORIES) {
      for (const [name, scope] of Object.entries(themes)) expect(cssVar(scope, `cat-${c}`), `${c} in ${name}`).toBeDefined()
    }
  })

  test('light and dark colours reach 4.5:1 on the background, since Table view uses them for text', () => {
    for (const theme of [themes.light, themes.dark]) {
      const bg = cssVar(theme, 'neu-bg')!
      for (const c of CATEGORIES) expect(contrast(cssVar(theme, `cat-${c}`)!, bg), c).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('rows, the summary bar, the legend and Table view each style every category', () => {
    for (const c of CATEGORIES) {
      expect(css).toContain(`.task-row[data-category='${c}']`)
      expect(css).toContain(`.category-segment[data-category='${c}']`)
      expect(css).toContain(`.category-legend [data-category='${c}']`)
      expect(css).toContain(`.table-row[data-category='${c}'] .table-meta`)
    }
  })

  test('the contrast theme gives every category but Office its own fill, shared by the bar and the legend', () => {
    expect(css).toMatch(/\.category-segment \{[^}]*background: var\(--cat-fill, var\(--cat\)\)/)
    expect(css).toMatch(/\.category-legend span::before \{[^}]*background: var\(--cat-fill, var\(--cat\)\)/)
    const fills = CATEGORIES.filter((c) => c !== 'office').map((c) => {
      const m = new RegExp(`\\[data-theme='contrast'\\] \\[data-category='${c}'\\] \\{ --cat-fill: ([^;]+);`).exec(css)
      expect(m, c).not.toBeNull()
      return m![1]
    })
    expect(new Set(fills).size).toBe(fills.length)
  })

  test('a legend entry draws one swatch, not a second one for the icon inside it', () => {
    expect(css).toContain('.category-legend span span::before { content: none; }')
  })

  test('the old third key has no styles left', () => {
    expect(css).not.toMatch(/free[l]ance/)
  })
})
