import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useMemo, useRef, useState } from "react"

import { DetailPanel } from "~components/DetailPanel"
import { OverlayBar, useTextareaRect } from "~components/OverlayBar"
import { SessionButton } from "~components/SessionButton"
import { SessionPanel } from "~components/SessionPanel"
import { calculateImpact, estimateTokens } from "~lib/calculator"
import {
  classifyPrompt,
  type DetectedAttachment,
  type TaskType
} from "~lib/classifier"
import { evaluateNudges, type Nudge } from "~lib/nudges"
import {
  detectAttachments,
  findTextarea,
  getPlatform,
  getTextContent,
  type TextInputElement
} from "~lib/platforms"
import { addPrompt, saveCurrentSession, useSession } from "~lib/session"
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
  const [attachments, setAttachments] = useState<DetectedAttachment[]>([])
  const [dark, setDark] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [smartMode, setSmartMode] = useChromeBoolean("smartMode", false)
  const [smartSuggestion, setSmartSuggestion] = useState<SmartSuggestion | null>(
    null
  )
  const [sessionOpen, setSessionOpen] = useState(false)
  const session = useSession()
  const [barOffset, setBarOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0
  })
  const [pathname, setPathname] = useState<string>(
    typeof window !== "undefined" ? window.location.pathname : "/"
  )

  // Watch for SPA navigations and reset/restore the bar offset per chat.
  useEffect(() => {
    const check = () => {
      if (window.location.pathname !== pathname) {
        setPathname(window.location.pathname)
      }
    }
    const id = window.setInterval(check, 400)
    window.addEventListener("popstate", check)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("popstate", check)
    }
  }, [pathname])

  // Load offset for the current path; default to 0,0 (i.e., new chat resets).
  useEffect(() => {
    const key = `offprint:bar-offset:${pathname}`
    try {
      chrome?.storage?.local?.get([key], (res) => {
        const v = res?.[key]
        if (
          v &&
          typeof v.x === "number" &&
          typeof v.y === "number"
        ) {
          setBarOffset({ x: v.x, y: v.y })
        } else {
          setBarOffset({ x: 0, y: 0 })
        }
      })
    } catch {
      setBarOffset({ x: 0, y: 0 })
    }
  }, [pathname])

  const persistBarOffset = (next: { x: number; y: number }) => {
    setBarOffset(next)
    try {
      const key = `offprint:bar-offset:${window.location.pathname}`
      chrome?.storage?.local?.set({ [key]: next })
    } catch {
      /* noop */
    }
  }
  const messageCount = session.totals.promptCount
  const recentTaskTypes: TaskType[] = useMemo(
    () => session.prompts.slice(-5).map((p) => p.taskType as TaskType),
    [session.prompts]
  )

  const lastSubmittedTextRef = useRef("")

  useEffect(() => {
    console.log(`${LOG_PREFIX} content script loaded on`, getPlatform())
    const stop = observeTheme(setDark)
    const onUnload = () => saveCurrentSession()
    window.addEventListener("beforeunload", onUnload)
    const autoSave = window.setInterval(() => saveCurrentSession(), 60_000)
    return () => {
      stop()
      window.removeEventListener("beforeunload", onUnload)
      window.clearInterval(autoSave)
    }
  }, [])

  const lastNonEmptyRef = useRef("")
  const lastFireAtRef = useRef(0)
  const messageCountRef = useRef(0)

  useEffect(() => {
    messageCountRef.current = messageCount
  }, [messageCount])

  useEffect(() => {
    let currentEl: TextInputElement | null = null

    const lastAttachmentsRef = { current: [] as DetectedAttachment[] }

    const fireSubmit = (t: string) => {
      console.log(
        `${LOG_PREFIX} Message submitted — ~${estimateTokens(t)} tokens`
      )
      const mc = messageCountRef.current
      lastSubmittedTextRef.current = t
      addPrompt(t, mc, lastAttachmentsRef.current)
    }

    const syncFromEl = () => {
      if (!currentEl) return
      const t = getTextContent(currentEl)
      const trimmed = t.trim()
      setText(t)
      const found = detectAttachments(currentEl)
      lastAttachmentsRef.current = found
      setAttachments((prev) => {
        if (
          prev.length === found.length &&
          prev.every((p, i) => p.filename === found[i].filename)
        )
          return prev
        return found
      })
      if (trimmed.length === 0 && lastNonEmptyRef.current.length > 0) {
        const now = Date.now()
        if (now - lastFireAtRef.current > 400) {
          lastFireAtRef.current = now
          fireSubmit(lastNonEmptyRef.current)
        }
        lastNonEmptyRef.current = ""
      } else if (trimmed.length > 0) {
        lastNonEmptyRef.current = trimmed
      }
    }

    const detach = () => {
      if (currentEl) {
        currentEl.removeEventListener("input", syncFromEl)
        currentEl.removeEventListener("keyup", syncFromEl)
        currentEl.removeEventListener("compositionend", syncFromEl)
      }
      currentEl = null
    }

    const attach = () => {
      const next = findTextarea()
      if (next && next !== currentEl) {
        // If old element had pending non-empty text and is now gone, treat as submit
        if (
          currentEl &&
          !document.contains(currentEl) &&
          lastNonEmptyRef.current.length > 0
        ) {
          const now = Date.now()
          if (now - lastFireAtRef.current > 400) {
            lastFireAtRef.current = now
            fireSubmit(lastNonEmptyRef.current)
          }
          lastNonEmptyRef.current = ""
        }
        detach()
        currentEl = next
        next.addEventListener("input", syncFromEl)
        next.addEventListener("keyup", syncFromEl)
        next.addEventListener("compositionend", syncFromEl)
        setEl(next)
        const initial = getTextContent(next)
        setText(initial)
        lastNonEmptyRef.current = initial.trim()
        console.log(`${LOG_PREFIX} attached to text input`, next)
      } else if (!next && currentEl && !document.contains(currentEl)) {
        if (lastNonEmptyRef.current.length > 0) {
          const now = Date.now()
          if (now - lastFireAtRef.current > 400) {
            lastFireAtRef.current = now
            fireSubmit(lastNonEmptyRef.current)
          }
          lastNonEmptyRef.current = ""
        }
        detach()
        setEl(null)
        setText("")
      }
    }

    attach()
    const observer = new MutationObserver(() => attach())
    observer.observe(document.body, { childList: true, subtree: true })
    const reattachInterval = window.setInterval(attach, 500)
    const pollInterval = window.setInterval(syncFromEl, 250)

    return () => {
      observer.disconnect()
      window.clearInterval(reattachInterval)
      window.clearInterval(pollInterval)
      detach()
    }
  }, [])

  const visible = text.trim().length > 0 || attachments.length > 0
  const rect = useTextareaRect(el, true)

  const debouncedText = useDebounced(text, 300)
  const classification = useMemo(
    () => classifyPrompt(debouncedText, messageCount),
    [debouncedText, messageCount]
  )
  const impact = useMemo(
    () => calculateImpact(text.length, classification, attachments),
    [text, classification, attachments]
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
        recentTaskTypes,
        attachments
      }),
    [
      debouncedText,
      impact.tokens,
      messageCount,
      classification,
      recentTaskTypes,
      attachments
    ]
  )
  const nudges = allNudges.filter((n) => !dismissed.has(n.id))

  const smartDebounced = useDebounced(text, 800)
  useEffect(() => {
    if (!smartMode) {
      setSmartSuggestion(null)
      return
    }
    const trimmed = smartDebounced.trim()
    if (trimmed.length === 0) {
      setSmartSuggestion(null)
      return
    }
    const cls = classifyPrompt(smartDebounced, messageCount)
    setSmartSuggestion(
      smartAnalyze({
        text: smartDebounced,
        classification: cls,
        attachments,
        messageCount,
        recentTaskTypes
      })
    )
  }, [smartMode, smartDebounced, messageCount, attachments, recentTaskTypes])

  return (
    <>
      <OverlayBar
        visible={visible}
        impact={impact}
        classification={classification}
        attachmentCount={attachments.length}
        rect={rect}
        dark={dark}
        expanded={expanded}
        hasNudges={smartMode ? !!smartSuggestion : nudges.length > 0}
        offset={barOffset}
        onToggle={() => setExpanded((v) => !v)}
        onDrag={setBarOffset}
        onDragEnd={persistBarOffset}
      />
      <DetailPanel
        open={visible && expanded}
        impact={impact}
        rect={rect}
        dark={dark}
        nudges={nudges}
        attachments={attachments}
        offset={barOffset}
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
      <SessionButton
        session={session}
        dark={dark}
        hidden={sessionOpen}
        onClick={() => setSessionOpen((v) => !v)}
      />
      <SessionPanel
        open={sessionOpen}
        session={session}
        dark={dark}
        onRequestClose={() => {
          setSessionOpen(false)
          saveCurrentSession()
        }}
      />
    </>
  )
}

export default Overlay
