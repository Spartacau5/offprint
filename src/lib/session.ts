import { useEffect, useState } from "react"

import { calculateImpact } from "./calculator"
import {
  classifyPrompt,
  type DetectedAttachment,
  type TaskType
} from "./classifier"
import { getPlatform } from "./platforms"

export interface PromptRecord {
  timestamp: number
  inputTokens: number
  estimatedOutputTokens: number
  taskType: TaskType
  energyMultiplier: number
  energyWh: number
  co2Grams: number
  waterMl: number
  attachmentCount: number
  attachmentTypes: string[]
  attachmentTokens: number
}

export interface SessionTotals {
  promptCount: number
  inputTokens: number
  estimatedOutputTokens: number
  energyWh: number
  co2Grams: number
  waterMl: number
}

export interface SessionData {
  startTime: number
  platform: ReturnType<typeof getPlatform>
  prompts: PromptRecord[]
  totals: SessionTotals
  taskBreakdown: Record<string, number>
  taskEnergy: Record<string, number>
}

const STORAGE_KEY = "offprint:session"
const SESSIONS_KEY = "offprint_sessions"
const ALLTIME_KEY = "offprint_alltime"
const SNAPSHOT_KEY = "offprint:last_snapshot"
const MAX_SESSIONS_DAYS = 30

export interface SavedSession {
  id: string
  date: string
  platform: ReturnType<typeof getPlatform>
  promptCount: number
  totalInputTokens: number
  totalEstimatedOutputTokens: number
  totalEnergyWh: number
  totalCo2Grams: number
  totalWaterMl: number
  taskBreakdown: Record<string, number>
  attachmentCount: number
  avgTokensPerPrompt: number
}

export interface AllTimeStats {
  totalSessions: number
  totalPrompts: number
  totalEnergyWh: number
  totalCo2Grams: number
  totalWaterMl: number
  firstSessionDate: string
}

const emptyAllTime = (): AllTimeStats => ({
  totalSessions: 0,
  totalPrompts: 0,
  totalEnergyWh: 0,
  totalCo2Grams: 0,
  totalWaterMl: 0,
  firstSessionDate: ""
})

function sessionId(s: SessionData): string {
  return `${s.platform}-${s.startTime}`
}

function isoDate(ts: number): string {
  const d = new Date(ts)
  return d.toISOString().slice(0, 10)
}

function snapshot(s: SessionData): SavedSession {
  const t = s.totals
  const attachmentCount = s.prompts.reduce(
    (n, p) => n + (p.attachmentCount ?? 0),
    0
  )
  return {
    id: sessionId(s),
    date: isoDate(s.startTime),
    platform: s.platform,
    promptCount: t.promptCount,
    totalInputTokens: t.inputTokens,
    totalEstimatedOutputTokens: t.estimatedOutputTokens,
    totalEnergyWh: t.energyWh,
    totalCo2Grams: t.co2Grams,
    totalWaterMl: t.waterMl,
    taskBreakdown: { ...s.taskBreakdown },
    attachmentCount,
    avgTokensPerPrompt:
      t.promptCount === 0 ? 0 : Math.round(t.inputTokens / t.promptCount)
  }
}

function pruneOld(sessions: SavedSession[]): SavedSession[] {
  const cutoff = Date.now() - MAX_SESSIONS_DAYS * 24 * 60 * 60 * 1000
  return sessions.filter((s) => {
    const ts = new Date(s.date).getTime()
    return isFinite(ts) ? ts >= cutoff : true
  })
}

export function saveCurrentSession(): void {
  if (session.totals.promptCount === 0) return
  if (typeof chrome === "undefined" || !chrome?.storage?.local) return
  try {
    chrome.storage.local.get(
      [SESSIONS_KEY, ALLTIME_KEY, SNAPSHOT_KEY],
      (res) => {
        const sessions: SavedSession[] = Array.isArray(res?.[SESSIONS_KEY])
          ? res[SESSIONS_KEY]
          : []
        const alltime: AllTimeStats = res?.[ALLTIME_KEY] ?? emptyAllTime()
        const snaps: Record<string, SavedSession> =
          res?.[SNAPSHOT_KEY] ?? {}

        const id = sessionId(session)
        const current = snapshot(session)
        const prev = snaps[id]

        // Delta against prior snapshot for this session id (or full when new)
        const isNew = !prev
        const deltaPrompts =
          current.promptCount - (prev?.promptCount ?? 0)
        const deltaEnergy =
          current.totalEnergyWh - (prev?.totalEnergyWh ?? 0)
        const deltaCo2 = current.totalCo2Grams - (prev?.totalCo2Grams ?? 0)
        const deltaWater = current.totalWaterMl - (prev?.totalWaterMl ?? 0)

        if (deltaPrompts > 0 || deltaEnergy > 0) {
          alltime.totalPrompts += Math.max(0, deltaPrompts)
          alltime.totalEnergyWh += Math.max(0, deltaEnergy)
          alltime.totalCo2Grams += Math.max(0, deltaCo2)
          alltime.totalWaterMl += Math.max(0, deltaWater)
          if (isNew) {
            alltime.totalSessions += 1
            if (!alltime.firstSessionDate)
              alltime.firstSessionDate = current.date
          }
        }

        // Upsert into sessions array
        const idx = sessions.findIndex((s) => s.id === id)
        if (idx >= 0) sessions[idx] = current
        else sessions.push(current)

        const pruned = pruneOld(sessions)
        snaps[id] = current

        chrome.storage.local.set({
          [SESSIONS_KEY]: pruned,
          [ALLTIME_KEY]: alltime,
          [SNAPSHOT_KEY]: snaps
        })
      }
    )
  } catch {
    /* noop */
  }
}

export function getSavedSessions(): Promise<SavedSession[]> {
  return new Promise((resolve) => {
    try {
      chrome?.storage?.local?.get([SESSIONS_KEY], (res) => {
        const sessions: SavedSession[] = Array.isArray(res?.[SESSIONS_KEY])
          ? res[SESSIONS_KEY]
          : []
        resolve(sessions)
      })
    } catch {
      resolve([])
    }
  })
}

export function getAllTimeStats(): Promise<AllTimeStats> {
  return new Promise((resolve) => {
    try {
      chrome?.storage?.local?.get([ALLTIME_KEY], (res) => {
        resolve(res?.[ALLTIME_KEY] ?? emptyAllTime())
      })
    } catch {
      resolve(emptyAllTime())
    }
  })
}

function emptySession(): SessionData {
  return {
    startTime: Date.now(),
    platform: getPlatform(),
    prompts: [],
    totals: {
      promptCount: 0,
      inputTokens: 0,
      estimatedOutputTokens: 0,
      energyWh: 0,
      co2Grams: 0,
      waterMl: 0
    },
    taskBreakdown: {},
    taskEnergy: {}
  }
}

let session: SessionData = emptySession()
const listeners = new Set<(s: SessionData) => void>()
let hydrated = false

function emit() {
  for (const l of listeners) l(session)
  if (hydrated) {
    try {
      chrome?.storage?.local?.set({ [STORAGE_KEY]: session })
    } catch {
      /* noop */
    }
  }
}

function isValidSession(v: unknown): v is SessionData {
  if (!v || typeof v !== "object") return false
  const s = v as Partial<SessionData>
  return (
    typeof s.startTime === "number" &&
    Array.isArray(s.prompts) &&
    !!s.totals &&
    typeof s.totals.promptCount === "number"
  )
}

function hydrate() {
  try {
    chrome?.storage?.local?.get([STORAGE_KEY], (res) => {
      const stored = res?.[STORAGE_KEY]
      if (isValidSession(stored) && stored.platform === getPlatform()) {
        session = {
          ...emptySession(),
          ...stored,
          taskBreakdown: stored.taskBreakdown ?? {},
          taskEnergy: stored.taskEnergy ?? {}
        }
      }
      hydrated = true
      for (const l of listeners) l(session)
    })
  } catch {
    hydrated = true
  }
}

if (typeof chrome !== "undefined" && chrome?.storage?.local) {
  hydrate()
} else {
  hydrated = true
}

export function getSession(): SessionData {
  return session
}

export function resetSession() {
  session = emptySession()
  emit()
}

export function addPrompt(
  text: string,
  messageCount: number,
  attachments: DetectedAttachment[] = []
): PromptRecord {
  const classification = classifyPrompt(text, messageCount)
  const impact = calculateImpact(text.length, classification, attachments)
  const attachmentTokens = attachments.reduce(
    (s, a) => s + a.estimatedTokens,
    0
  )
  const record: PromptRecord = {
    timestamp: Date.now(),
    inputTokens: impact.inputTokens,
    estimatedOutputTokens: impact.outputTokens,
    taskType: classification.taskType,
    energyMultiplier: Math.max(
      classification.energyMultiplier,
      ...attachments.map((a) => a.energyMultiplier),
      1
    ),
    energyWh: impact.energyWh,
    co2Grams: impact.co2Grams,
    waterMl: impact.waterMl,
    attachmentCount: attachments.length,
    attachmentTypes: attachments.map((a) => a.type),
    attachmentTokens
  }
  session = {
    ...session,
    prompts: [...session.prompts, record],
    totals: {
      promptCount: session.totals.promptCount + 1,
      inputTokens: session.totals.inputTokens + record.inputTokens,
      estimatedOutputTokens:
        session.totals.estimatedOutputTokens + record.estimatedOutputTokens,
      energyWh: session.totals.energyWh + record.energyWh,
      co2Grams: session.totals.co2Grams + record.co2Grams,
      waterMl: session.totals.waterMl + record.waterMl
    },
    taskBreakdown: {
      ...session.taskBreakdown,
      [record.taskType]: (session.taskBreakdown[record.taskType] ?? 0) + 1
    },
    taskEnergy: {
      ...session.taskEnergy,
      [record.taskType]:
        (session.taskEnergy[record.taskType] ?? 0) + record.energyWh
    }
  }
  emit()
  saveCurrentSession()
  return record
}

export function useSession(): SessionData {
  const [s, setS] = useState<SessionData>(session)
  useEffect(() => {
    listeners.add(setS)
    setS(session)
    return () => {
      listeners.delete(setS)
    }
  }, [])
  return s
}
