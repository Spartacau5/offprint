import { useEffect, useRef, useState } from "react"

import {
  formatGrams,
  formatMl,
  formatWh,
  type ImpactResult
} from "~lib/calculator"
import { useAnimatedNumber } from "~lib/useAnimatedNumber"

import { BoltIcon, CloudIcon, DropletIcon, LeafIcon, XIcon } from "./icons"
import { FONT_STACK, getSurface } from "./OverlayBar"

type Rect = { top: number; left: number; width: number }

export type DetailPanelProps = {
  open: boolean
  impact: ImpactResult
  rect: Rect | null
  dark: boolean
  onRequestClose: () => void
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

        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${surface.divider}`,
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 10,
            fontWeight: 500,
            opacity: 0.4,
            color: "#10B981",
            letterSpacing: "0.02em"
          }}>
          Offprint
        </div>
      </div>
    </div>
  )
}
