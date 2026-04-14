import { useEffect, useState } from "react"

import type { ImpactLevel } from "~lib/calculator"
import type { Nudge, NudgeIcon } from "~lib/nudges"

import {
  FileIcon,
  LightbulbIcon,
  RefreshIcon,
  ScissorsIcon,
  SearchIcon,
  TargetIcon,
  XIcon
} from "./icons"
import type { Surface } from "./OverlayBar"

const ICONS: Record<NudgeIcon, typeof LightbulbIcon> = {
  lightbulb: LightbulbIcon,
  target: TargetIcon,
  file: FileIcon,
  search: SearchIcon,
  refresh: RefreshIcon,
  scissors: ScissorsIcon
}

const LEVEL_BORDER: Record<ImpactLevel, string> = {
  low: "#10B981",
  medium: "#F59E0B",
  high: "#EF4444"
}

export type NudgeCardProps = {
  nudge: Nudge
  surface: Surface
  dark: boolean
  level: ImpactLevel
  index: number
  onDismiss: (id: string) => void
}

export const NudgeCard = ({
  nudge,
  surface,
  dark,
  level,
  index,
  onDismiss
}: NudgeCardProps) => {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 80 * index)
    return () => window.clearTimeout(t)
  }, [index])

  const cardBg = dark
    ? "rgba(255,255,255,0.04)"
    : "rgba(0,0,0,0.035)"

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: 12,
        borderRadius: 8,
        background: cardBg,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateX(0)" : "translateX(8px)",
        transition: "opacity 200ms ease, transform 200ms ease"
      }}>
      <div
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 400,
          lineHeight: 1.45,
          color: surface.text
        }}>
        {nudge.message}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onDismiss(nudge.id)}
        style={{
          all: "unset",
          cursor: "pointer",
          flexShrink: 0,
          color: surface.textSecondary,
          opacity: 0.7,
          transition: "opacity 150ms ease, color 150ms ease",
          marginTop: -2,
          marginRight: -2
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1"
          e.currentTarget.style.color = surface.text
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.7"
          e.currentTarget.style.color = surface.textSecondary
        }}>
        <XIcon size={10} color="currentColor" />
      </button>
    </div>
  )
}

export const NudgesSection = ({
  nudges,
  surface,
  dark,
  level,
  onDismiss
}: {
  nudges: Nudge[]
  surface: Surface
  dark: boolean
  level: ImpactLevel
  onDismiss: (id: string) => void
}) => {
  if (nudges.length === 0) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: surface.textSecondary,
          marginBottom: 8
        }}>
        <LightbulbIcon size={12} color={surface.textSecondary} />
        Efficiency Tips
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {nudges.map((n, i) => (
          <NudgeCard
            key={n.id}
            nudge={n}
            surface={surface}
            dark={dark}
            level={level}
            index={i}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  )
}
