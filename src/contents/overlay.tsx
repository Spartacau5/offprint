import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

import { DetailPanel } from "~components/DetailPanel"
import { OverlayBar, useTextareaRect } from "~components/OverlayBar"
import { calculateImpact, estimateTokens } from "~lib/calculator"
import {
  findSendButton,
  findTextarea,
  getPlatform,
  getTextContent,
  type TextInputElement
} from "~lib/platforms"
import { observeTheme } from "~lib/theme"

export const config: PlasmoCSConfig = {
  matches: ["https://chatgpt.com/*", "https://claude.ai/*"],
  all_frames: false,
  run_at: "document_idle"
}

const LOG_PREFIX = "[Offprint]"

const Overlay = () => {
  const [el, setEl] = useState<TextInputElement | null>(null)
  const [text, setText] = useState("")
  const [dark, setDark] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    console.log(`${LOG_PREFIX} content script loaded on`, getPlatform())
    return observeTheme(setDark)
  }, [])

  useEffect(() => {
    let currentEl: TextInputElement | null = null
    let currentSendBtn: HTMLElement | null = null

    const onInput = () => {
      if (!currentEl) return
      const t = getTextContent(currentEl)
      setText(t)
      console.log(`${LOG_PREFIX} input:`, {
        preview: t.slice(0, 100),
        chars: t.length,
        tokens: estimateTokens(t)
      })
    }

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        const t = currentEl ? getTextContent(currentEl) : ""
        if (t.trim().length > 0) {
          console.log(
            `${LOG_PREFIX} Message submitted — ~${estimateTokens(t)} tokens`
          )
        }
      }
    }

    const onSendClick = () => {
      const t = currentEl ? getTextContent(currentEl) : ""
      if (t.trim().length > 0) {
        console.log(
          `${LOG_PREFIX} Message submitted — ~${estimateTokens(t)} tokens`
        )
      }
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
  }, [])

  const visible = text.trim().length > 0
  const rect = useTextareaRect(el, true)
  const impact = calculateImpact(text.length)

  useEffect(() => {
    if (!visible && expanded) setExpanded(false)
  }, [visible, expanded])

  return (
    <>
      <OverlayBar
        visible={visible}
        impact={impact}
        rect={rect}
        dark={dark}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      <DetailPanel
        open={visible && expanded}
        impact={impact}
        rect={rect}
        dark={dark}
        onRequestClose={() => setExpanded(false)}
      />
    </>
  )
}

export default Overlay
