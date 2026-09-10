/**
 * The theme, living outside React (like session-socket.ts). `system` is a
 * stored value, never a CSS mode: this module resolves it and writes a concrete
 * `data-theme` on <html>, which is the only thing styles.css looks at.
 *
 * See docs/adr/0013-theme-is-a-device-preference.md for why this one piece of
 * UI state is not in the URL. The inline script in index.html repeats the
 * first resolution so the page paints in the right theme before this loads.
 */
export const THEMES = ["system", "light", "dark"] as const

export type Theme = (typeof THEMES)[number]

/** What `system` resolves to: the only thing the DOM ever carries. */
export type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "grill-ui:theme"

const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && THEMES.some((known) => known === value)

const read = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isTheme(stored) ? stored : "system"
  } catch {
    // Storage can be blocked (private windows, hardened settings).
    return "system"
  }
}

const prefersLight = matchMedia("(prefers-color-scheme: light)")

let theme = read()
const listeners = new Set<() => void>()

const resolve = (value: Theme): ResolvedTheme => {
  if (value !== "system") {
    return value
  }
  return prefersLight.matches ? "light" : "dark"
}

const apply = (): void => {
  document.documentElement.dataset.theme = resolve(theme)
}

const emit = (): void => {
  for (const listener of listeners) {
    listener()
  }
}

prefersLight.addEventListener("change", () => {
  if (theme === "system") {
    apply()
    // Consumers of the *resolved* theme (the sandboxed aside frame) need this.
    emit()
  }
})

// index.html resolved the theme before first paint; re-apply so the DOM cannot
// drift from this module if the two ever disagree.
apply()

export const getTheme = (): Theme => theme

export const getResolvedTheme = (): ResolvedTheme => resolve(theme)

export const subscribeTheme = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const setTheme = (next: Theme): void => {
  theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Not being able to remember it is not a reason to not apply it.
  }
  apply()
  emit()
}

/** system → light → dark → system, the order the toggle cycles in. */
export const nextTheme = (current: Theme): Theme => {
  const index = THEMES.indexOf(current)
  return THEMES[(index + 1) % THEMES.length] ?? "system"
}
