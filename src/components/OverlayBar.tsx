import { useEffect, useMemo, useRef, useState } from "react"

import {
  formatGrams,
  formatMl,
  formatWh,
  type ImpactLevel,
  type ImpactResult
} from "~lib/calculator"
import { TASK_LABELS, type ClassificationResult } from "~lib/classifier"
import { useAnimatedNumber } from "~lib/useAnimatedNumber"

import {
  BoltIcon,
  CloudIcon,
  DropletIcon,
  LeafIcon,
  PaperclipIcon
} from "./icons"

type Rect = { top: number; left: number; width: number }

export type Surface = {
  bg: string
  border: string
  shadow: string
  text: string
  textSecondary: string
  divider: string
}

export function getSurface(dark: boolean): Surface {
  return dark
    ? {
        bg: "rgba(0,0,0,0.45)",
        border: "rgba(255,255,255,0.12)",
        shadow: "0 8px 32px rgba(0,0,0,0.3)",
        text: "rgba(255,255,255,0.95)",
        textSecondary: "rgba(255,255,255,0.6)",
        divider: "rgba(255,255,255,0.12)"
      }
    : {
        bg: "rgba(255,255,255,0.65)",
        border: "rgba(0,0,0,0.08)",
        shadow: "0 8px 32px rgba(0,0,0,0.08)",
        text: "rgba(0,0,0,0.9)",
        textSecondary: "rgba(0,0,0,0.5)",
        divider: "rgba(0,0,0,0.08)"
      }
}

export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif'

const LEVEL_LABELS: Record<ImpactLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High"
}

const LEVEL_COLORS: Record<
  ImpactLevel,
  { bg: string; fg: string; fgLight: string; glow: string }
> = {
  low: {
    bg: "rgba(16,185,129,0.15)",
    fg: "#10B981",
    fgLight: "#059669",
    glow: "0 0 8px rgba(16,185,129,0.3)"
  },
  medium: {
    bg: "rgba(245,158,11,0.15)",
    fg: "#F59E0B",
    fgLight: "#D97706",
    glow: "0 0 8px rgba(245,158,11,0.3)"
  },
  high: {
    bg: "rgba(239,68,68,0.15)",
    fg: "#EF4444",
    fgLight: "#DC2626",
    glow: "0 0 8px rgba(239,68,68,0.3)"
  }
}

export type OverlayBarProps = {
  visible: boolean
  impact: ImpactResult
  classification: ClassificationResult
  attachmentCount: number
  rect: Rect | null
  dark: boolean
  expanded: boolean
  hasNudges: boolean
  offset: { x: number; y: number }
  onToggle: () => void
  onDrag: (offset: { x: number; y: number }) => void
  onDragEnd: (offset: { x: number; y: number }) => void
}

const PULSE_KEYFRAMES = `@keyframes offprint-pulse { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }`

const Separator = ({ color }: { color: string }) => (
  <span
    style={{
      width: 3,
      height: 3,
      borderRadius: "50%",
      background: color,
      display: "inline-block",
      flexShrink: 0
    }}
  />
)

export const OverlayBar = ({
  visible,
  impact,
  classification,
  attachmentCount,
  rect,
  dark,
  expanded,
  hasNudges,
  offset,
  onToggle,
  onDrag,
  onDragEnd
}: OverlayBarProps) => {
  const surface = getSurface(dark)
  const colors = LEVEL_COLORS[impact.impactLevel]

  const energy = useAnimatedNumber(impact.energyWh)
  const water = useAnimatedNumber(impact.waterMl)
  const co2 = useAnimatedNumber(impact.co2Grams)

  const dragRef = useRef<{
    startX: number
    startY: number
    startOffset: { x: number; y: number }
    moved: boolean
    active: boolean
    last: { x: number; y: number }
  }>({
    startX: 0,
    startY: 0,
    startOffset: { x: 0, y: 0 },
    moved: false,
    active: false,
    last: { x: 0, y: 0 }
  })
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const springRef = useRef<number | null>(null)

  if (!rect) return null

  const baseTop = Math.max(8, rect.top - 48)
  const baseLeft = rect.left + rect.width / 2
  const top = baseTop + offset.y
  const left = baseLeft + offset.x

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffset: offset,
      moved: false,
      active: true,
      last: offset
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (!dragRef.current.moved && Math.hypot(dx, dy) > 4) {
      dragRef.current.moved = true
    }
    if (dragRef.current.moved) {
      const next = {
        x: dragRef.current.startOffset.x + dx,
        y: dragRef.current.startOffset.y + dy
      }
      dragRef.current.last = next
      onDrag(next)
    }
  }

  const animateOffsetTo = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    duration = 280
  ) => {
    if (springRef.current !== null) cancelAnimationFrame(springRef.current)
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-in-out cubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const next = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased
      }
      onDrag(next)
      if (t < 1) {
        springRef.current = requestAnimationFrame(tick)
      } else {
        springRef.current = null
        onDragEnd(to)
      }
    }
    springRef.current = requestAnimationFrame(tick)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const wasDrag = dragRef.current.moved
    dragRef.current.active = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    if (!wasDrag) {
      onToggle()
      return
    }

    // Clamp the bar's actual rendered rect inside the viewport. If it spilled
    // outside, compute the offset correction needed and spring back.
    const last = dragRef.current.last
    const btn = btnRef.current
    const margin = 8
    if (!btn) {
      onDragEnd(last)
      return
    }
    const r = btn.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let dx = 0
    let dy = 0
    if (r.left < margin) dx = margin - r.left
    else if (r.right > vw - margin) dx = vw - margin - r.right
    if (r.top < margin) dy = margin - r.top
    else if (r.bottom > vh - margin) dy = vh - margin - r.bottom

    if (dx === 0 && dy === 0) {
      onDragEnd(last)
      return
    }
    animateOffsetTo(last, { x: last.x + dx, y: last.y + dy })
  }

  return (
    <div
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        transform: "translateX(-50%)",
        zIndex: 2147483640,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: visible ? "opacity 200ms ease" : "opacity 150ms ease",
        fontFamily: FONT_STACK
      }}>
      <button
        ref={btnRef}
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-expanded={expanded}
        title="Drag to move"
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: dragRef.current.active && dragRef.current.moved ? "grabbing" : "grab",
          touchAction: "none",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 16px",
          minHeight: "36px",
          borderRadius: "20px",
          background: surface.bg,
          backdropFilter: "blur(16px) saturate(120%)",
          WebkitBackdropFilter: "blur(16px) saturate(120%)",
          border: `1px solid ${surface.border}`,
          boxShadow: `${surface.shadow}, inset 0 1px 0 ${
            dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)"
          }`,
          color: surface.text,
          fontFamily: FONT_STACK,
          fontFeatureSettings: '"tnum"',
          fontVariantNumeric: "tabular-nums",
          transition:
            "background 300ms ease, border-color 300ms ease, color 300ms ease, box-shadow 300ms ease"
        }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
            letterSpacing: "-0.01em"
          }}>
          <BoltIcon size={13} color="#FACC15" />
          {formatWh(energy)} Wh
        </span>

        {attachmentCount > 0 && (
          <span
            title={`${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11,
              color: surface.textSecondary,
              whiteSpace: "nowrap"
            }}>
            <PaperclipIcon size={12} color={surface.textSecondary} />
            {attachmentCount}
          </span>
        )}

        <span
          style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: colors.bg,
            color: dark ? colors.fg : colors.fgLight,
            textShadow: dark ? colors.glow : "none",
            transition:
              "background 300ms ease, color 300ms ease, text-shadow 300ms ease"
          }}>
          {LEVEL_LABELS[impact.impactLevel]}
        </span>

        {classification.taskType !== "unknown" && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: surface.textSecondary,
              whiteSpace: "nowrap",
              letterSpacing: "-0.005em"
            }}>
            {TASK_LABELS[classification.taskType]}
          </span>
        )}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap"
          }}>
          <DropletIcon size={13} color="#3B82F6" />
          {formatMl(water)} mL
        </span>

        <Separator color={surface.textSecondary} />

        {hasNudges && !expanded && (
          <span
            aria-label="Efficiency tips available"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#F59E0B",
              display: "inline-block",
              flexShrink: 0,
              animation: "offprint-pulse 2s ease-in-out infinite"
            }}
          />
        )}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap"
          }}>
          <LeafIcon size={13} color="#10B981" />
          {formatGrams(co2)}g CO₂
        </span>
      </button>
      <style>{PULSE_KEYFRAMES}</style>
    </div>
  )
}

export function useTextareaRect(
  el: HTMLElement | null,
  enabled: boolean
): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!el || !enabled) {
      setRect(null)
      return
    }

    const update = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width })
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)

    const mo = new MutationObserver(update)
    if (el.parentElement) {
      mo.observe(el.parentElement, {
        attributes: true,
        childList: true,
        subtree: false
      })
    }

    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    const interval = window.setInterval(update, 500)

    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      window.clearInterval(interval)
    }
  }, [el, enabled])

  return useMemo(() => rect, [rect])
}
