import type { ClassificationResult } from "./classifier"

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

export function calculateImpact(
  characterCount: number,
  classification?: ClassificationResult
): ImpactResult {
  const inputTokens = Math.ceil(Math.max(0, characterCount) / 4)
  const outputTokens =
    classification?.estimatedOutputTokens ?? Math.max(150, inputTokens * 3)
  const totalTokens = inputTokens + outputTokens
  const multiplier = classification?.energyMultiplier ?? 1

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
      energy: `≈ charging your phone for ${formatDuration(phoneChargeSeconds)}`,
      water: `≈ ${fmtSmall(sipsOfWater)} sips of water`,
      carbon: `≈ driving ${fmtInt(drivingMeters)}m`
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
