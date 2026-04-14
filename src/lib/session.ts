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
