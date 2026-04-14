import { useEffect, useRef, useState } from "react"

import {
  carbonComparison,
  energyComparison,
  formatGrams,
  formatMl,
  formatWh,
  sessionEnergySentence
} from "~lib/calculator"
import { TASK_LABELS, type TaskType } from "~lib/classifier"
import type { SessionData } from "~lib/session"

import { DropletIcon, TreeIcon, XIcon } from "./icons"
import { FONT_STACK, getSurface, type Surface } from "./OverlayBar"

const SPRING = "cubic-bezier(0.16, 1, 0.3, 1)"

const SHINE_KEYFRAMES = `@keyframes offprint-shine {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(440%); }
}`

const TASK_TIER: Record<TaskType, "low" | "medium" | "high"> = {
  text_generation: "low",
  text_short: "low",
  conversation: "low",
  editing: "low",
  summarization: "low",
  brainstorm: "low",
  code_generation: "medium",
  code_debug: "medium",
  data_analysis: "medium",
  research: "medium",
  file_creation: "medium",
  translation: "medium",
  image_generation: "high",
  video_generation: "high",
  unknown: "low"
}

const TIER_COLOR = {
  low: "#10B981",
  medium: "#F59E0B",
  high: "#EF4444"
} as const

export type SessionPanelProps = {
  open: boolean
  session: SessionData
  dark: boolean
  onRequestClose: () => void
}

const StatCard = ({
  surface,
  dark,
  value,
  label,
  sub
}: {
  surface: Surface
  dark: boolean
  value: string
  label: string
  sub?: string
}) => {
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.035)"
  return (
    <div
      style={{
        background: cardBg,
        borderRadius: 8,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: 64
      }}>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "#10B981",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1
        }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: surface.textSecondary }}>{label}</div>
      {sub ? (
        <div
          style={{
            fontSize: 10,
            color: surface.textSecondary,
            opacity: 0.7,
            marginTop: 2,
            fontStyle: "italic"
          }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

const TaskBreakdown = ({
  session,
  surface
}: {
  session: SessionData
  surface: Surface
}) => {
  const entries = Object.entries(session.taskEnergy).filter(
    ([, e]) => (e ?? 0) > 0
  ) as Array<[TaskType, number]>
  const total = entries.reduce((s, [, e]) => s + e, 0)
  if (entries.length === 0 || total === 0) return null

  entries.sort((a, b) => b[1] - a[1])

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          display: "flex",
          background: surface.divider
        }}>
        {entries.map(([t, e]) => (
          <div
            key={t}
            style={{
              width: `${(e / total) * 100}%`,
              background: TIER_COLOR[TASK_TIER[t]],
              transition: "width 300ms ease"
            }}
          />
        ))}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: "30%",
            background:
              "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)",
            pointerEvents: "none",
            animation: "offprint-shine 3s linear infinite"
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 12px",
          marginTop: 8
        }}>
        {entries.map(([t]) => (
          <div
            key={t}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              color: surface.textSecondary
            }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: TIER_COLOR[TASK_TIER[t]]
              }}
            />
            {TASK_LABELS[t]}
          </div>
        ))}
      </div>
    </div>
  )
}

const OffsetButton = ({
  color,
  bg,
  border,
  hoverBg,
  href,
  icon,
  label
}: {
  color: string
  bg: string
  border: string
  hoverBg: string
  href: string
  icon: React.ReactNode
  label: string
}) => {
  const [hover, setHover] = useState(false)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: hover ? hoverBg : bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transform: hover ? "scale(1.02)" : "scale(1)",
        transition: "background 150ms ease, transform 150ms ease"
      }}>
      {icon}
      {label}
    </a>
  )
}

export const SessionPanel = ({
  open,
  session,
  dark,
  onRequestClose
}: SessionPanelProps) => {
  const surface = getSurface(dark)
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) setMounted(true)
    else {
      const t = window.setTimeout(() => setMounted(false), 220)
      return () => window.clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      const root = ref.current.getRootNode() as ShadowRoot | Document
      const path = e.composedPath()
      if (path.includes(root)) return
      onRequestClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRequestClose()
    }
    document.addEventListener("mousedown", onDoc, true)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("mousedown", onDoc, true)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open, onRequestClose])

  if (!mounted) return null

  const t = session.totals
  const offsetCost = (t.co2Grams * 0.015) / 1000
  const costStr =
    offsetCost < 0.01 ? "< $0.01" : `$${offsetCost.toFixed(2)}`
  const sessionLine = sessionEnergySentence(t.energyWh)

  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 2147483641,
        width: 340,
        maxHeight: 520,
        overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: `${surface.divider} transparent`,
        opacity: open ? 1 : 0,
        transform: open
          ? "translateY(0) scale(1)"
          : "translateY(8px) scale(0.95)",
        transformOrigin: "bottom right",
        transition: open
          ? `opacity 250ms ${SPRING}, transform 250ms ${SPRING}`
          : "opacity 200ms ease, transform 200ms ease",
        pointerEvents: open ? "auto" : "none",
        fontFamily: FONT_STACK
      }}>
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 16,
          background: surface.bg,
          backdropFilter: "blur(16px) saturate(120%)",
          WebkitBackdropFilter: "blur(16px) saturate(120%)",
          border: `1px solid ${surface.border}`,
          boxShadow: `${surface.shadow}, inset 0 1px 0 ${
            dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)"
          }`,
          color: surface.text,
          fontVariantNumeric: "tabular-nums"
        }}>
        <style>{SHINE_KEYFRAMES}</style>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
          }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Your Session
          </div>
          <button
            type="button"
            aria-label="Close"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRequestClose}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 6,
              color: surface.textSecondary,
              transition: "color 150ms ease, background 150ms ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = surface.text
              e.currentTarget.style.background = surface.divider
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = surface.textSecondary
              e.currentTarget.style.background = "transparent"
            }}>
            <XIcon size={16} color="currentColor" />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8
          }}>
          <StatCard
            surface={surface}
            dark={dark}
            value={String(t.promptCount)}
            label="prompts"
          />
          <StatCard
            surface={surface}
            dark={dark}
            value={`${formatWh(t.energyWh)} Wh`}
            label="energy"
            sub={energyComparison(t.energyWh)}
          />
          <StatCard
            surface={surface}
            dark={dark}
            value={`${formatGrams(t.co2Grams)}g`}
            label="CO₂"
            sub={carbonComparison(t.co2Grams)}
          />
        </div>

        {sessionLine ? (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              fontStyle: "italic",
              color: surface.textSecondary,
              lineHeight: 1.4
            }}>
            This session used as much energy as {sessionLine}.
          </div>
        ) : null}

        <TaskBreakdown session={session} surface={surface} />

        <div
          style={{
            height: 1,
            background: surface.divider,
            margin: "16px 0"
          }}
        />

        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.03) 100%)",
            border: "1px solid rgba(16,185,129,0.15)",
            borderRadius: 12,
            padding: 16
          }}>
          <a
            href="https://onetreeplanted.org/products/plant-trees"
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: 12,
              borderRadius: 10,
              background: "rgba(16,185,129,0.15)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#10B981",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
              boxSizing: "border-box",
              transition: "background 150ms ease, transform 150ms ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(16,185,129,0.25)"
              e.currentTarget.style.transform = "scale(1.01)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(16,185,129,0.15)"
              e.currentTarget.style.transform = "scale(1)"
            }}>
            <TreeIcon size={16} color="#10B981" />
            Offset Your Impact
          </a>
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              color: surface.textSecondary,
              opacity: 0.75
            }}>
            Your session's CO₂ offset costs {costStr}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: `1px solid ${surface.divider}`,
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 10,
            fontWeight: 500,
            opacity: 0.4,
            color: "#10B981"
          }}>
          Offprint
        </div>
      </div>
    </div>
  )
}
