export function isDarkMode(): boolean {
  const html = document.documentElement
  if (html.classList.contains("dark")) return true
  const theme = html.getAttribute("data-theme") || html.getAttribute("data-mode")
  if (theme && /dark/i.test(theme)) return true
  if (html.style.colorScheme === "dark") return true

  const bg = getComputedStyle(document.body).backgroundColor
  const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) {
    const r = parseInt(m[1], 10)
    const g = parseInt(m[2], 10)
    const b = parseInt(m[3], 10)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (luminance < 128) return true
    if (luminance >= 128) return false
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function observeTheme(cb: (dark: boolean) => void): () => void {
  let last = isDarkMode()
  cb(last)

  const check = () => {
    const next = isDarkMode()
    if (next !== last) {
      last = next
      cb(next)
    }
  }

  const observer = new MutationObserver(check)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "data-mode", "style"]
  })
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style"]
  })

  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  const onMq = () => check()
  mq.addEventListener("change", onMq)

  return () => {
    observer.disconnect()
    mq.removeEventListener("change", onMq)
  }
}
