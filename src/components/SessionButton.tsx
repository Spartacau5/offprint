import { useEffect, useState } from "react"

import { formatGrams } from "~lib/calculator"
import type { SessionData } from "~lib/session"

import { LeafIcon } from "./icons"
import { FONT_STACK, getSurface } from "./OverlayBar"

const PULSE_KEYFRAMES = `@keyframes offprint-session-pulse {
  0% { transform: scale(1); }
  3.3% { transform: scale(1.03); }
  6.6% { transform: scale(1); }
  100% { transform: scale(1); }
}
@keyframes offprint-session-in {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}`

export type SessionButtonProps = {
  session: SessionData
  dark: boolean
  hidden: boolean
  onClick: () => void
}

export const SessionButton = ({
  session,
  dark,
  hidden,
  onClick
}: SessionButtonProps) => {
  const surface = getSurface(dark)
  const [hover, setHover] = useState(false)

  if (session.totals.promptCount === 0) return null

  const count = session.totals.promptCount
  const co2 = session.totals.co2Grams

  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Open session summary"
        style={{
          all: "unset",
          cursor: "pointer",
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 2147483640,
          display: hidden ? "none" : "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 2,
          padding: "10px 16px",
          minWidth: 96,
          borderRadius: 16,
          background: surface.bg,
          backdropFilter: "blur(16px) saturate(120%)",
          WebkitBackdropFilter: "blur(16px) saturate(120%)",
          border: `1px solid ${surface.border}`,
          boxShadow: `${surface.shadow}, inset 0 1px 0 ${
            dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)"
          }`,
          color: surface.text,
          fontFamily: FONT_STACK,
          fontVariantNumeric: "tabular-nums",
          animation:
            "offprint-session-in 300ms ease-out, offprint-session-pulse 30s ease-in-out 30s infinite",
          transform: hover ? "scale(1.04)" : "scale(1)",
          filter: hover ? "brightness(1.08)" : "none",
          transition: "transform 150ms ease, filter 150ms ease"
        }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: surface.textSecondary,
            marginBottom: 2
          }}>
          Session Usage
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "-0.01em"
          }}>
          <LeafIcon size={14} color="#10B981" />
          {count} prompt{count === 1 ? "" : "s"}
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 400,
            color: surface.textSecondary,
            fontVariantNumeric: "tabular-nums"
          }}>
          {formatGrams(co2)}g CO₂
        </div>
      </button>
    </>
  )
}
