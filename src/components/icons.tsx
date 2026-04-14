import type { CSSProperties } from "react"

type IconProps = {
  size?: number
  color?: string
  style?: CSSProperties
}

const base = (size: number, color: string, style?: CSSProperties) => ({
  width: size,
  height: size,
  stroke: color,
  fill: "none" as const,
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style
})

export const LeafIcon = ({ size = 16, color = "#10B981", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c1.4 9.3-1.5 17.04-8.2 17.04Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6" />
  </svg>
)

export const BoltIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M13 2 4.5 13.5h6L11 22l8.5-11.5h-6L13 2Z" />
  </svg>
)

export const DropletIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z" />
  </svg>
)

export const CloudIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 11 4 4 0 0 0 7 19h10.5Z" />
  </svg>
)

export const XIcon = ({ size = 14, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
