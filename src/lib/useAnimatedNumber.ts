import { useEffect, useRef, useState } from "react"

export function useAnimatedNumber(target: number, duration = 400): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const startRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const from = fromRef.current
    const to = target
    if (from === to) return

    cancelAnimationFrame(rafRef.current)
    startRef.current = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from + (to - from) * eased
      setValue(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
