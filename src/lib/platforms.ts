export type Platform = "chatgpt" | "claude" | "unknown"

export type TextInputElement = HTMLTextAreaElement | HTMLElement

export function getPlatform(): Platform {
  const host = window.location.hostname
  if (host.endsWith("chatgpt.com") || host.endsWith("chat.openai.com")) {
    return "chatgpt"
  }
  if (host.endsWith("claude.ai")) {
    return "claude"
  }
  return "unknown"
}

export function findTextarea(): TextInputElement | null {
  const platform = getPlatform()

  if (platform === "chatgpt") {
    const ta = document.querySelector<HTMLTextAreaElement>("#prompt-textarea")
    if (ta) return ta
    const editable = document.querySelector<HTMLElement>(
      'form div[contenteditable="true"], main div[contenteditable="true"]'
    )
    if (editable) return editable
  }

  if (platform === "claude") {
    const editable = document.querySelector<HTMLElement>(
      'div[contenteditable="true"][translate="no"], fieldset div[contenteditable="true"], div[contenteditable="true"]'
    )
    if (editable) return editable
  }

  return null
}

export function getTextContent(element: TextInputElement | null): string {
  if (!element) return ""
  if (element instanceof HTMLTextAreaElement) {
    return element.value ?? ""
  }
  return (element.textContent ?? "").replace(/\u00A0/g, " ")
}

export function findSendButton(): HTMLElement | null {
  const platform = getPlatform()
  if (platform === "chatgpt") {
    return document.querySelector<HTMLElement>(
      'button[data-testid="send-button"], button[aria-label*="Send" i]'
    )
  }
  if (platform === "claude") {
    return document.querySelector<HTMLElement>(
      'button[aria-label*="Send" i], fieldset button[type="button"]'
    )
  }
  return null
}
