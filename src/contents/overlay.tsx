import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useMemo, useRef, useState } from "react"

import { DetailPanel } from "~components/DetailPanel"
import { OverlayBar, useTextareaRect } from "~components/OverlayBar"
import { calculateImpact, estimateTokens } from "~lib/calculator"
import { classifyPrompt, type TaskType } from "~lib/classifier"
import { evaluateNudges, type Nudge } from "~lib/nudges"
import {
  findSendButton,
  findTextarea,
  getPlatform,
  getTextContent,
  type TextInputElement
} from "~lib/platforms"
import { smartAnalyze, type SmartSuggestion } from "~lib/smart"
import { useChromeBoolean } from "~lib/storage"
import { observeTheme } from "~lib/theme"

export const config: PlasmoCSConfig = {
  matches: ["https://chatgpt.com/*", "https://claude.ai/*"],
  all_frames: false,
  run_at: "document_idle"
}

const LOG_PREFIX = "[Offprint]"

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay)
    return () => window.clearTimeout(t)
  }, [value, delay])
  return v
}

const Overlay = () => {
  const [el, setEl] = useState<TextInputElement | null>(null)
  const [text, setText] = useState("")
  const [dark, setDark] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [recentTaskTypes, setRecentTaskTypes] = useState<TaskType[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [smartMode, setSmartMode] = useChromeBoolean("smartMode", false)
  const [smartSuggestion, setSmartSuggestion] = useState<SmartSuggestion | null>(
    null
  )

  const lastSubmittedTextRef = useRef("")

  useEffect(() => {
    console.log(`${LOG_PREFIX} content script loaded on`, getPlatform())
    return observeTheme(setDark)
  }, [])

  useEffect(() => {
    let currentEl: TextInputElement | null = null
    let currentSendBtn: HTMLElement | null = null

    const onInput = () => {
      if (!currentEl) return
      setText(getTextContent(currentEl))
    }

    const onSubmit = (t: string) => {
      console.log(
        `${LOG_PREFIX} Message submitted — ~${estimateTokens(t)} tokens`
      )
      const cls = classifyPrompt(t, messageCount)
      lastSubmittedTextRef.current = t
      setMessageCount((c) => c + 1)
      setRecentTaskTypes((prev) => [...prev.slice(-4), cls.taskType])
    }

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        const t = currentEl ? getTextContent(currentEl) : ""
        if (t.trim().length > 0) onSubmit(t)
      }
    }

    const onSendClick = () => {
      const t = currentEl ? getTextContent(currentEl) : ""
      if (t.trim().length > 0) onSubmit(t)
    }

    const detach = () => {
      if (currentEl) {
        currentEl.removeEventListener("input", onInput)
        currentEl.removeEventListener("keyup", onInput)
        currentEl.removeEventListener("compositionend", onInput)
        currentEl.removeEventListener("keydown", onKeydown)
      }
      if (currentSendBtn) {
        currentSendBtn.removeEventListener("click", onSendClick)
      }
      currentEl = null
      currentSendBtn = null
    }

    const attach = () => {
      const next = findTextarea()
      if (next && next !== currentEl) {
        detach()
        currentEl = next
        next.addEventListener("input", onInput)
        next.addEventListener("keyup", onInput)
        next.addEventListener("compositionend", onInput)
        next.addEventListener("keydown", onKeydown)
        setEl(next)
        setText(getTextContent(next))
        console.log(`${LOG_PREFIX} attached to text input`, next)
      } else if (!next && currentEl && !document.contains(currentEl)) {
        detach()
        setEl(null)
        setText("")
      }

      const btn = findSendButton()
      if (btn && btn !== currentSendBtn) {
        if (currentSendBtn) {
          currentSendBtn.removeEventListener("click", onSendClick)
        }
        currentSendBtn = btn
        btn.addEventListener("click", onSendClick)
      }
    }

    attach()
    const observer = new MutationObserver(() => attach())
    observer.observe(document.body, { childList: true, subtree: true })
    const interval = window.setInterval(attach, 2000)

    return () => {
      observer.disconnect()
      window.clearInterval(interval)
      detach()
    }
  }, [messageCount])

  const visible = text.trim().length > 0
  const rect = useTextareaRect(el, true)

  const debouncedText = useDebounced(text, 300)
  const classification = useMemo(
    () => classifyPrompt(debouncedText, messageCount),
    [debouncedText, messageCount]
  )
  const impact = useMemo(
    () => calculateImpact(text.length, classification),
    [text, classification]
  )

  useEffect(() => {
    if (!visible && expanded) setExpanded(false)
  }, [visible, expanded])

  useEffect(() => {
    if (!visible && dismissed.size > 0) setDismissed(new Set())
  }, [visible, dismissed.size])

  const allNudges: Nudge[] = useMemo(
    () =>
      evaluateNudges({
        text: debouncedText,
        tokens: impact.tokens,
        charCount: debouncedText.length,
        messageCount,
        classification,
        recentTaskTypes
      }),
    [debouncedText, impact.tokens, messageCount, classification, recentTaskTypes]
  )
  const nudges = allNudges.filter((n) => !dismissed.has(n.id))

  const smartDebounced = useDebounced(text, 1500)
  useEffect(() => {
    if (!smartMode) {
      setSmartSuggestion(null)
      return
    }
    if (smartDebounced.trim().length < 50) {
      setSmartSuggestion(null)
      return
    }
    const cls = classifyPrompt(smartDebounced, messageCount)
    setSmartSuggestion(smartAnalyze(smartDebounced, cls))
  }, [smartMode, smartDebounced, messageCount])

  return (
    <>
      <OverlayBar
        visible={visible}
        impact={impact}
        classification={classification}
        rect={rect}
        dark={dark}
        expanded={expanded}
        hasNudges={smartMode ? !!smartSuggestion : nudges.length > 0}
        onToggle={() => setExpanded((v) => !v)}
      />
      <DetailPanel
        open={visible && expanded}
        impact={impact}
        rect={rect}
        dark={dark}
        nudges={nudges}
        smartMode={smartMode}
        onSmartModeChange={setSmartMode}
        smartSuggestion={smartSuggestion}
        onDismissNudge={(id) =>
          setDismissed((prev) => {
            const next = new Set(prev)
            next.add(id)
            return next
          })
        }
        onRequestClose={() => setExpanded(false)}
      />
    </>
  )
}

export default Overlay
