import { useEffect, useRef, useState } from "react"

import {
  formatGrams,
  formatMl,
  formatWh,
  type ImpactResult
} from "~lib/calculator"
import { useAnimatedNumber } from "~lib/useAnimatedNumber"

import type { Nudge } from "~lib/nudges"
import type { SmartSuggestion } from "~lib/smart"

import {
  BoltIcon,
  CloudIcon,
  DropletIcon,
  LeafIcon,
  SparkleIcon,
  XIcon
} from "./icons"
import { NudgesSection } from "./NudgeCard"
import { FONT_STACK, getSurface, type Surface } from "./OverlayBar"

type Rect = { top: number; left: number; width: number }

export type DetailPanelProps = {
  open: boolean
  impact: ImpactResult
  rect: Rect | null
  dark: boolean
  nudges: Nudge[]
  smartMode: boolean
  onSmartModeChange: (v: boolean) => void
  smartSuggestion: SmartSuggestion | null
  onDismissNudge: (id: string) => void
  onRequestClose: () => void
}

const SmartToggle = ({
  on,
  surface,
  onChange
}: {
  on: boolean
  surface: Surface
  onChange: (v: boolean) => void
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => onChange(!on)}
    style={{
      all: "unset",
      cursor: "pointer",
      width: 30,
      height: 18,
      borderRadius: 9,
      background: on ? "#10B981" : surface.divider,
      position: "relative",
      transition: "background 200ms ease",
      display: "inline-block",
      flexShrink: 0
    }}>
    <span
      style={{
        position: "absolute",
        top: 2,
        left: on ? 14 : 2,
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        transition: "left 200ms ease"
      }}
    />
  </button>
)

const SmartCard = ({
  suggestion,
  surface,
  dark
}: {
  suggestion: SmartSuggestion
  surface: Surface
  dark: boolean
}) => {
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.035)"
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: surface.textSecondary,
          marginBottom: 8
        }}>
        <SparkleIcon size={12} color="#10B981" />
        Smart Suggestion
      </div>
      <div
        style={{
          position: "relative",
          padding: 12,
          borderRadius: 8,
          background: cardBg
        }}>
        <svg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "visible"
          }}>
          <rect
            x="0.5"
            y="0.5"
            width="calc(100% - 1px)"
            height="calc(100% - 1px)"
            rx="7.5"
            ry="7.5"
            fill="none"
            stroke="#10B981"
            strokeWidth="1"
            pathLength={100}
            strokeDasharray="0 50 0 50">
            <animate
              attributeName="stroke-dasharray"
              from="0 50 0 50"
              to="50 0 50 0"
              dur="650ms"
              begin="0s"
              fill="freeze"
              calcMode="spline"
              keyTimes="0;1"
              keySplines="0.42 0 0.58 1"
            />
          </rect>
        </svg>
        <div
          style={{
            position: "relative",
            fontSize: 13,
            lineHeight: 1.45,
            color: surface.text
          }}>
          {suggestion.message}
        </div>
      </div>
    </div>
  )
}

const SPRING = "cubic-bezier(0.16, 1, 0.3, 1)"

const Row = ({
  icon,
  label,
  value,
  comparison,
  surface
}: {
  icon: React.ReactNode
  label: string
  value: string
  comparison: string
  surface: ReturnType<typeof getSurface>
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0"
    }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 92,
        color: surface.text,
        fontSize: 13,
        fontWeight: 500
      }}>
      {icon}
      <span>{label}</span>
    </div>
    <div
      style={{
        flex: "0 0 auto",
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        color: surface.text,
        minWidth: 90
      }}>
      {value}
    </div>
    <div
      style={{
        flex: "1 1 auto",
        fontSize: 13,
        fontWeight: 400,
        color: surface.textSecondary,
        textAlign: "right"
      }}>
      {comparison}
    </div>
  </div>
)

export const DetailPanel = ({
  open,
  impact,
  rect,
  dark,
  nudges,
  smartMode,
  onSmartModeChange,
  smartSuggestion,
  onDismissNudge,
  onRequestClose
}: DetailPanelProps) => {
  const surface = getSurface(dark)
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)

  const energy = useAnimatedNumber(impact.energyWh)
  const water = useAnimatedNumber(impact.waterMl)
  const co2 = useAnimatedNumber(impact.co2Grams)

  useEffect(() => {
    if (open) setMounted(true)
    else {
      const t = window.setTimeout(() => setMounted(false), 260)
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

  if (!rect || !mounted) return null

  const barTop = Math.max(8, rect.top - 48)
  const PANEL_WIDTH = Math.min(Math.max(rect.width, 360), 520)
  const left = rect.left + rect.width / 2

  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: `${barTop - 8}px`,
        left: `${left}px`,
        transform: `translate(-50%, -100%) translateY(${open ? 0 : 8}px) scale(${open ? 1 : 0.98})`,
        transformOrigin: "bottom center",
        opacity: open ? 1 : 0,
        zIndex: 2147483639,
        width: `${PANEL_WIDTH}px`,
        transition: `opacity 250ms ${SPRING}, transform 250ms ${SPRING}`,
        fontFamily: FONT_STACK,
        pointerEvents: open ? "auto" : "none"
      }}>
      <div
        style={{
          padding: "16px 20px",
          borderRadius: 16,
          background: surface.bg,
          backdropFilter: "blur(16px) saturate(120%)",
          WebkitBackdropFilter: "blur(16px) saturate(120%)",
          border: `1px solid ${surface.border}`,
          boxShadow: surface.shadow,
          color: surface.text
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6
          }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.01em"
            }}>
            Estimated Impact
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 11,
                color: surface.textSecondary
              }}
              title="Uses minimal AI for better suggestions">
              <SparkleIcon size={12} color={smartMode ? "#10B981" : surface.textSecondary} />
              <span>Smart</span>
              <SmartToggle
                on={smartMode}
                surface={surface}
                onChange={onSmartModeChange}
              />
            </label>
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
              width: 22,
              height: 22,
              marginRight: -4,
              borderRadius: 6,
              color: surface.text,
              opacity: 0.7,
              transition: "opacity 150ms ease, background 150ms ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1"
              e.currentTarget.style.background = surface.divider
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.7"
              e.currentTarget.style.background = "transparent"
            }}>
              <XIcon size={14} color={surface.text} />
            </button>
          </div>
        </div>

        <Row
          icon={<BoltIcon size={16} color="#FACC15" />}
          label="Energy"
          value={`${formatWh(energy)} Wh`}
          comparison={impact.comparisons.energy}
          surface={surface}
        />
        <div style={{ height: 1, background: surface.divider }} />
        <Row
          icon={<DropletIcon size={16} color="#3B82F6" />}
          label="Water"
          value={`${formatMl(water)} mL`}
          comparison={impact.comparisons.water}
          surface={surface}
        />
        <div style={{ height: 1, background: surface.divider }} />
        <Row
          icon={<LeafIcon size={16} color="#10B981" />}
          label="Carbon"
          value={`${formatGrams(co2)}g`}
          comparison={impact.comparisons.carbon}
          surface={surface}
        />

        {smartMode && smartSuggestion ? (
          <SmartCard suggestion={smartSuggestion} surface={surface} dark={dark} />
        ) : (
          <NudgesSection
            nudges={nudges}
            surface={surface}
            dark={dark}
            level={impact.impactLevel}
            onDismiss={onDismissNudge}
          />
        )}

        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${surface.divider}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.02em"
          }}>
          <span
            style={{
              fontStyle: "italic",
              color: surface.textSecondary,
              opacity: smartMode ? 0.8 : 0
            }}>
            Smart Mode uses ~0.001 Wh per analysis
          </span>
          <span style={{ opacity: 0.4, color: "#10B981" }}>Offprint</span>
        </div>
      </div>
    </div>
  )
}
