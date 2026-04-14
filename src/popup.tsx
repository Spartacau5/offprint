import { useEffect, useState } from "react"

import "~style.css"

import { LeafIcon } from "~components/icons"
import {
  getAllTimeStats,
  getSavedSessions,
  type AllTimeStats,
  type SavedSession
} from "~lib/session"

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif'

const card: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow:
    "0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
  borderRadius: 14
}

// Tiny SVG fractalNoise tile for the background grain.
const NOISE_DATA_URL =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`
  )

const fmtCo2 = (g: number): string => {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  if (g < 1) return `${g.toFixed(2)} g`
  return `${g.toFixed(1)} g`
}
const fmtWater = (ml: number): string => {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`
  if (ml < 1) return `${ml.toFixed(2)} mL`
  return `${ml.toFixed(1)} mL`
}
const fmtKm = (g: number) =>
  g / 210 >= 1 ? Math.round(g / 210) : (g / 210).toFixed(1)
const fmtGlasses = (ml: number) =>
  ml / 250 >= 1 ? Math.round(ml / 250) : (ml / 250).toFixed(1)

function dateLabel(iso: string): string {
  const today = new Date()
  const t = new Date(iso + "T00:00:00")
  const diff = Math.round(
    (new Date(today.toISOString().slice(0, 10) + "T00:00:00").getTime() -
      t.getTime()) /
      (24 * 60 * 60 * 1000)
  )
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function last7Days(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]
const dayLetterForISO = (iso: string) =>
  DAY_LETTERS[new Date(iso + "T00:00:00").getDay()]

// Compute average energyMultiplier across a day's sessions.
function avgMultiplierForDay(items: SavedSession[]): number {
  if (items.length === 0) return 1
  const totalTokens = items.reduce(
    (s, x) => s + x.totalInputTokens + x.totalEstimatedOutputTokens,
    0
  )
  if (totalTokens === 0) return 1
  const baseEnergyWh = (totalTokens / 250) * 0.34 * 1.3
  const totalEnergy = items.reduce((s, x) => s + x.totalEnergyWh, 0)
  if (baseEnergyWh === 0) return 1
  return totalEnergy / baseEnergyWh
}

function multiplierColor(m: number): string {
  if (m < 2) return "#10B981"
  if (m < 10) return "#F59E0B"
  return "#EF4444"
}

function efficiencyScore(
  totals: AllTimeStats,
  sessions: SavedSession[]
): number | null {
  if (totals.totalPrompts === 0) return null
  const totalInput = sessions.reduce((s, x) => s + x.totalInputTokens, 0)
  const avgTokens = totalInput / Math.max(1, totals.totalPrompts)
  let raw = Math.round(100 - (avgTokens - 50) / 10)
  raw = Math.max(5, Math.min(98, raw))
  let img = 0
  let vid = 0
  let shortLow = 0
  for (const s of sessions) {
    img += s.taskBreakdown.image_generation ?? 0
    vid += s.taskBreakdown.video_generation ?? 0
    shortLow +=
      (s.taskBreakdown.text_short ?? 0) +
      (s.taskBreakdown.conversation ?? 0) +
      (s.taskBreakdown.summarization ?? 0)
  }
  const high = (img + vid) / totals.totalPrompts
  const low = shortLow / totals.totalPrompts
  const adj = Math.round(low * 15) - Math.round(high * 20)
  return Math.max(5, Math.min(98, raw + adj))
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10B981"
  if (score >= 40) return "#F59E0B"
  return "#EF4444"
}

const PLATFORM_BADGE: Record<
  string,
  { letter: string; bg: string; fg: string }
> = {
  chatgpt: { letter: "G", bg: "rgba(16,185,129,0.10)", fg: "#10B981" },
  claude: { letter: "C", bg: "rgba(249,115,22,0.10)", fg: "#F97316" },
  unknown: { letter: "?", bg: "rgba(255,255,255,0.06)", fg: "#9CA3AF" }
}

const KEYFRAMES = `
@keyframes offprint-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes offprint-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}`

const Skeleton = ({
  height,
  width = "100%",
  radius = 8
}: {
  height: number
  width?: number | string
  radius?: number
}) => (
  <div
    style={{
      height,
      width,
      borderRadius: radius,
      background:
        "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
      backgroundSize: "200% 100%",
      animation: "offprint-shimmer 1.4s ease-in-out infinite"
    }}
  />
)

const StatCol = ({
  num,
  label,
  comparison,
  divider
}: {
  num: string
  label: string
  comparison?: string
  divider?: boolean
}) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderLeft: divider ? "1px solid rgba(255,255,255,0.06)" : "none"
    }}>
    <div
      style={{
        fontSize: 24,
        fontWeight: 700,
        color: "#10B981",
        fontFeatureSettings: '"tnum"',
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.1,
        letterSpacing: "-0.02em"
      }}>
      {num}
    </div>
    <div
      style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.35)",
        textTransform: "uppercase",
        letterSpacing: "0.04em"
      }}>
      {label}
    </div>
    {comparison ? (
      <div
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.25)",
          fontStyle: "italic",
          textAlign: "center",
          marginTop: 2
        }}>
        {comparison}
      </div>
    ) : null}
  </div>
)

const Header = () => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <LeafIcon size={20} color="#10B981" />
      <span
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "#10B981",
          letterSpacing: "-0.01em"
        }}>
        Offprint
      </span>
    </div>
    <div
      style={{
        fontSize: 12,
        color: "rgba(255,255,255,0.4)",
        marginTop: 2
      }}>
      Your AI Footprint
    </div>
  </div>
)

const AllTimeCard = ({ alltime }: { alltime: AllTimeStats }) => (
  <div style={{ ...card, padding: "20px 16px" }}>
    <div style={{ display: "flex", gap: 0 }}>
      <StatCol
        num={alltime.totalPrompts.toLocaleString()}
        label="prompts"
      />
      <StatCol
        divider
        num={fmtCo2(alltime.totalCo2Grams)}
        label="CO₂"
        comparison={`≈ driving ${fmtKm(alltime.totalCo2Grams)}km`}
      />
      <StatCol
        divider
        num={fmtWater(alltime.totalWaterMl)}
        label="water"
        comparison={`≈ ${fmtGlasses(alltime.totalWaterMl)} glasses`}
      />
    </div>
  </div>
)

const ChartCard = ({ sessions }: { sessions: SavedSession[] }) => {
  const days = last7Days()
  const today = days[days.length - 1]
  const perDay = days.map((iso) => {
    const items = sessions.filter((s) => s.date === iso)
    const promptCount = items.reduce((n, s) => n + s.promptCount, 0)
    const avgMul = avgMultiplierForDay(items)
    return { iso, promptCount, avgMul }
  })
  const maxCount = Math.max(1, ...perDay.map((d) => d.promptCount))
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const CHART_H = 72

  return (
    <div style={{ ...card, padding: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.8)",
          marginBottom: 12
        }}>
        Last 7 Days
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 6,
          height: CHART_H,
          position: "relative"
        }}>
        {/* dashed midline */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            borderTop: "1px dashed rgba(255,255,255,0.04)",
            pointerEvents: "none"
          }}
        />
        {perDay.map((d, i) => {
          const has = d.promptCount > 0
          const h = has
            ? Math.max(8, (d.promptCount / maxCount) * CHART_H)
            : 4
          const color = has
            ? multiplierColor(d.avgMul)
            : "rgba(255,255,255,0.06)"
          const isToday = d.iso === today
          return (
            <div
              key={d.iso}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                flex: 1,
                maxWidth: 36,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                position: "relative",
                height: "100%"
              }}>
              {hoverIdx === i && has ? (
                <div
                  style={{
                    position: "absolute",
                    bottom: h + 6,
                    background: "rgba(0,0,0,0.85)",
                    color: "rgba(255,255,255,0.95)",
                    fontSize: 10,
                    padding: "3px 7px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    border: "1px solid rgba(255,255,255,0.08)"
                  }}>
                  {d.promptCount} prompt{d.promptCount === 1 ? "" : "s"}
                </div>
              ) : null}
              <div
                style={{
                  width: "100%",
                  height: h,
                  background: color,
                  borderRadius: "6px 6px 2px 2px",
                  boxShadow: isToday && has ? `0 0 12px ${color}33` : "none",
                  filter: hoverIdx === i ? "brightness(1.2)" : "none",
                  transition: "filter 150ms ease"
                }}
              />
            </div>
          )
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          marginTop: 6
        }}>
        {perDay.map((d) => {
          const isToday = d.iso === today
          return (
            <div
              key={d.iso}
              style={{
                flex: 1,
                maxWidth: 36,
                textAlign: "center",
                fontSize: 9,
                fontWeight: isToday ? 600 : 400,
                color: isToday
                  ? "rgba(255,255,255,0.6)"
                  : "rgba(255,255,255,0.25)"
              }}>
              {dayLetterForISO(d.iso)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ScoreCard = ({
  alltime,
  sessions
}: {
  alltime: AllTimeStats
  sessions: SavedSession[]
}) => {
  const score = efficiencyScore(alltime, sessions)
  const SIZE = 68
  const STROKE = 4
  const R = (SIZE - STROKE) / 2
  const C = 2 * Math.PI * R
  const color = score === null ? "rgba(255,255,255,0.2)" : scoreColor(score)
  const offset = score === null ? C : C * (1 - score / 100)
  return (
    <div
      style={{
        ...card,
        padding: 16,
        display: "flex",
        alignItems: "center"
      }}>
      <div
        style={{
          width: "45%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}>
        <div style={{ position: "relative", width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={STROKE}
              fill="none"
            />
            {score !== null && (
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                fill="none"
                style={{
                  filter: `drop-shadow(0 0 6px ${color}44)`,
                  transition: "stroke-dashoffset 400ms ease, stroke 300ms ease"
                }}
              />
            )}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
              color: score === null ? "rgba(255,255,255,0.3)" : "#fff",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em"
            }}>
            {score === null ? "--" : score}
          </div>
        </div>
      </div>
      <div
        style={{
          width: "55%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 4
        }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "-0.01em"
          }}>
          Efficiency Score
        </div>
        <div
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            lineHeight: 1.5
          }}>
          Based on prompt length and task complexity
        </div>
      </div>
    </div>
  )
}

const RecentRow = ({
  s,
  isFirst
}: {
  s: SavedSession
  isFirst: boolean
}) => {
  const badge = PLATFORM_BADGE[s.platform] ?? PLATFORM_BADGE.unknown
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 8px",
        margin: "0 -8px",
        borderRadius: 8,
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.04)",
        background: hover ? "rgba(255,255,255,0.02)" : "transparent",
        transition: "background 150ms ease"
      }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: badge.bg,
          color: badge.fg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 600
        }}>
        {badge.letter}
      </div>
      <div style={{ flex: 1, marginLeft: 10 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
          {dateLabel(s.date)}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
          {s.promptCount} prompt{s.promptCount === 1 ? "" : "s"}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.4)",
          fontVariantNumeric: "tabular-nums"
        }}>
        {fmtCo2(s.totalCo2Grams)}
      </div>
    </div>
  )
}

const RecentCard = ({ sessions }: { sessions: SavedSession[] }) => {
  const recent = [...sessions]
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .slice(0, 3)
  return (
    <div style={{ ...card, padding: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.8)",
          marginBottom: 6
        }}>
        Recent Sessions
      </div>
      {recent.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.3)",
            textAlign: "center",
            padding: "16px 0"
          }}>
          No sessions recorded yet
        </div>
      ) : (
        recent.map((s, i) => (
          <RecentRow key={s.id} s={s} isFirst={i === 0} />
        ))
      )}
    </div>
  )
}

const Footer = () => (
  <div style={{ marginTop: 16 }}>
    <div
      style={{
        height: 1,
        background: "rgba(255,255,255,0.04)",
        marginBottom: 12
      }}
    />
    <div
      style={{
        textAlign: "center",
        fontSize: 11,
        fontWeight: 500
      }}>
      <span style={{ color: "#10B981" }}>Off</span>
      <span style={{ color: "rgba(255,255,255,0.25)" }}>set your </span>
      <span style={{ color: "#10B981" }}>foot</span>
      <span style={{ color: "rgba(255,255,255,0.25)" }}>print</span>
    </div>
  </div>
)

const LoadingState = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ ...card, padding: "20px 16px" }}>
      <Skeleton height={56} />
    </div>
    <div style={{ ...card, padding: 16 }}>
      <Skeleton height={12} width={80} />
      <div style={{ height: 12 }} />
      <Skeleton height={72} />
    </div>
    <div style={{ ...card, padding: 16 }}>
      <Skeleton height={68} />
    </div>
    <div style={{ ...card, padding: 16 }}>
      <Skeleton height={12} width={120} />
      <div style={{ height: 12 }} />
      <Skeleton height={36} />
      <div style={{ height: 8 }} />
      <Skeleton height={36} />
    </div>
  </div>
)

function IndexPopup() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [alltime, setAlltime] = useState<AllTimeStats>({
    totalSessions: 0,
    totalPrompts: 0,
    totalEnergyWh: 0,
    totalCo2Grams: 0,
    totalWaterMl: 0,
    firstSessionDate: ""
  })

  useEffect(() => {
    let cancelled = false
    Promise.all([getSavedSessions(), getAllTimeStats()]).then(([s, a]) => {
      if (cancelled) return
      setSessions(s)
      setAlltime(a)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const cards = [
    <AllTimeCard key="alltime" alltime={alltime} />,
    <ChartCard key="chart" sessions={sessions} />,
    <ScoreCard key="score" alltime={alltime} sessions={sessions} />,
    <RecentCard key="recent" sessions={sessions} />
  ]

  return (
    <div
      style={{
        position: "relative",
        width: 380,
        height: 540,
        background:
          "linear-gradient(160deg, #06060a 0%, #0f1729 40%, #111827 70%, #0a0f1a 100%)",
        boxSizing: "border-box",
        fontFamily: FONT,
        color: "rgba(255,255,255,0.9)",
        overflow: "hidden"
      }}>
      {/* noise grain overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${NOISE_DATA_URL}")`,
          backgroundSize: "140px 140px",
          opacity: 0.03,
          pointerEvents: "none",
          mixBlendMode: "overlay"
        }}
      />
      <div
        className="offprint-scroll"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          overflowY: "auto",
          padding: 20,
          boxSizing: "border-box"
        }}>
        <style>{KEYFRAMES}</style>
        <Header />
        {loading ? (
          <LoadingState />
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cards.map((node, i) => (
              <div
                key={i}
                style={{
                  animation: `offprint-rise 200ms ease-out both`,
                  animationDelay: `${i * 60}ms`
                }}>
                {node}
              </div>
            ))}
            <div
              style={{
                animation: "offprint-rise 200ms ease-out both",
                animationDelay: `${cards.length * 60}ms`
              }}>
              <Footer />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default IndexPopup
