import type { ClassificationResult, DetectedAttachment } from "./classifier"

export type ImpactLevel = "low" | "medium" | "high"

export interface ImpactResult {
  tokens: number
  inputTokens: number
  outputTokens: number
  energyWh: number
  co2Grams: number
  waterMl: number
  impactLevel: ImpactLevel
  comparisons: {
    energy: string
    water: string
    carbon: string
  }
}

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function getImpactLevel(totalEnergyWh: number): ImpactLevel {
  if (totalEnergyWh < 0.5) return "low"
  if (totalEnergyWh < 3) return "medium"
  return "high"
}

function fmtInt(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString()
}

function fmtSmall(n: number): string {
  if (n < 1) return n.toFixed(2)
  if (n < 10) return n.toFixed(1)
  return Math.round(n).toLocaleString()
}

// Pick a relatable energy comparison based on Wh magnitude.
export function energyComparison(wh: number): string {
  if (!isFinite(wh) || wh <= 0) return ""
  if (wh < 0.1) {
    // LED ≈ 0.005 Wh/s (5W bulb)
    const seconds = wh / 0.005
    return `≈ powering an LED for ${formatDuration(seconds)}`
  }
  if (wh < 1) {
    // Full phone charge ≈ 15 Wh in ≈ 3600s → 1 Wh ≈ 240s of charging
    const seconds = wh * 240
    return `≈ ${formatDuration(seconds)} of phone charging`
  }
  if (wh < 15) {
    const pct = (wh / 15) * 100
    return `≈ ${fmtSmall(pct)}% of a full phone charge`
  }
  const charges = wh / 15
  return `≈ ${fmtSmall(charges)} full phone charge${charges >= 2 ? "s" : ""}`
}

// Pick a relatable carbon comparison based on grams CO₂ magnitude.
// Designed so each tier's number lands between ~1 and ~50 — feels concrete.
export function carbonComparison(g: number): string {
  if (!isFinite(g) || g <= 0) return ""
  if (g < 0.5) {
    // 1 min Netflix ≈ 0.6 g CO₂ → 1s ≈ 0.01 g CO₂
    const seconds = g / 0.01
    return `≈ ${formatDuration(seconds)} of streaming video`
  }
  if (g < 5) {
    // 1 min Netflix ≈ 0.6 g CO₂
    const minutes = g / 0.6
    return `≈ ${fmtSmall(minutes)} min of streaming video`
  }
  if (g < 30) {
    // 1 boil of a kettle ≈ 15 g CO₂
    const boils = g / 15
    return `≈ ${fmtSmall(boils)} kettle boil${boils >= 2 ? "s" : ""}`
  }
  if (g < 200) {
    // 1 full phone charge ≈ 8 g CO₂
    const charges = g / 8
    return `≈ ${fmtSmall(charges)} phone charge${charges >= 2 ? "s" : ""}`
  }
  // Average car ≈ 338 g CO₂/mile
  const miles = g / 338
  return `≈ a ${fmtSmall(miles)}-mile car trip`
}

// Big-picture comparison for cumulative session totals.
export function sessionEnergySentence(wh: number): string {
  if (!isFinite(wh) || wh <= 0) return ""
  if (wh < 1) {
    const seconds = wh * 240
    return `keeping a phone charging for ${fmtSmall(seconds)}s`
  }
  if (wh < 60) {
    // 60W bulb → 60 Wh per hour
    const minutes = (wh / 60) * 60
    return `keeping a lightbulb on for ${fmtSmall(minutes)} min`
  }
  // Streaming video ≈ 100 Wh/hour
  const minutes = (wh / 100) * 60
  return `streaming ${fmtSmall(minutes)} min of video`
}

export function sessionCarbonSentence(g: number): string {
  if (!isFinite(g) || g <= 0) return ""
  if (g < 5) {
    const minutes = g / 0.6
    return `${fmtSmall(minutes)} min of streaming video`
  }
  if (g < 50) {
    const charges = g / 8
    return `${fmtSmall(charges)} phone charges`
  }
  if (g < 500) {
    const km = g / 210
    return `driving ${fmtSmall(km)} km`
  }
  const miles = g / 338
  return `a ${fmtSmall(miles)}-mile car trip`
}

export function calculateImpact(
  characterCount: number,
  classification?: ClassificationResult,
  attachments?: DetectedAttachment[]
): ImpactResult {
  const inputTokens = Math.ceil(Math.max(0, characterCount) / 4)
  const outputTokens =
    classification?.estimatedOutputTokens ?? Math.max(150, inputTokens * 3)
  const attachmentTokens = (attachments ?? []).reduce(
    (s, a) => s + a.estimatedTokens,
    0
  )
  const totalTokens = inputTokens + outputTokens + attachmentTokens
  const baseMultiplier = classification?.energyMultiplier ?? 1
  const attachMultipliers = (attachments ?? []).map((a) => a.energyMultiplier)
  const multiplier = Math.max(baseMultiplier, ...attachMultipliers, 1)

  const baseEnergyWh = (totalTokens / 250) * 0.34
  const adjustedEnergyWh = baseEnergyWh * multiplier
  const totalEnergyWh = adjustedEnergyWh * 1.3
  const co2Grams = totalEnergyWh * 0.001 * 367
  const waterMl = totalEnergyWh * 0.001 * (1.9 + 4.54)

  const phoneChargeSeconds = (totalEnergyWh / 15) * 3600
  const sipsOfWater = waterMl / 25
  const drivingMeters = (co2Grams / 210) * 1000

  return {
    tokens: totalTokens,
    inputTokens,
    outputTokens,
    energyWh: totalEnergyWh,
    co2Grams,
    waterMl,
    impactLevel: getImpactLevel(totalEnergyWh),
    comparisons: {
      energy: energyComparison(totalEnergyWh),
      water: `≈ ${fmtSmall(sipsOfWater)} sips of water`,
      carbon: carbonComparison(co2Grams)
    }
  }
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "0s"
  if (seconds < 60) return `${fmtSmall(seconds)}s`
  const totalSec = Math.round(seconds)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return s ? `${h}h ${rm}m ${s}s` : `${h}h ${rm}m`
  }
  return s ? `${m}m ${s}s` : `${m}m`
}

export function formatWh(wh: number): string {
  if (wh < 0.01) return "< 0.01"
  return wh.toFixed(2)
}

export function formatMl(ml: number): string {
  if (ml < 0.01) return "< 0.01"
  if (ml < 10) return ml.toFixed(2)
  return ml.toFixed(1)
}

export function formatGrams(g: number): string {
  if (g < 0.01) return "< 0.01"
  if (g < 1) return g.toFixed(3)
  if (g < 10) return g.toFixed(2)
  return g.toFixed(1)
}
