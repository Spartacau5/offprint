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

export const LightbulbIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2Z" />
  </svg>
)

export const TargetIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)

export const FileIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
    <path d="M14 2v6h6" />
  </svg>
)

export const SearchIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const RefreshIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
)

export const SparkleIcon = ({ size = 14, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
)

export const ScissorsIcon = ({ size = 16, color = "currentColor", style }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, color, style)} aria-hidden="true">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
  </svg>
)
