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

import {
  classifyAttachmentByExtension,
  type DetectedAttachment
} from "./classifier"

const FILENAME_RE =
  /([\w\-. ()\[\]]+\.(png|jpe?g|gif|webp|svg|bmp|tiff?|heic|pdf|docx?|txt|rtf|md|odt|xlsx?|csv|tsv|py|js|ts|jsx|tsx|java|cpp|c|h|hpp|html|css|go|rs|rb|php|swift|kt|json|xml|yaml|yml|toml|mp4|mov|avi|webm|mkv|mp3|wav|m4a|ogg|flac|zip|tar|gz|rar|7z))\b/gi

const SIZE_RE = /(\d+(?:\.\d+)?)\s*(KB|MB|GB)/i

function parseSizeMB(text: string): number | undefined {
  const m = text.match(SIZE_RE)
  if (!m) return undefined
  const v = parseFloat(m[1])
  const unit = m[2].toUpperCase()
  if (unit === "KB") return v / 1024
  if (unit === "MB") return v
  if (unit === "GB") return v * 1024
  return undefined
}

function findComposerRoot(textEl: HTMLElement): HTMLElement {
  const form = textEl.closest("form") as HTMLElement | null
  if (form) return form
  let node: HTMLElement | null = textEl
  for (let i = 0; i < 8 && node?.parentElement; i++) {
    node = node.parentElement
  }
  return node ?? textEl
}

export function detectAttachments(
  textEl?: HTMLElement | null
): DetectedAttachment[] {
  const el = textEl ?? findTextarea()
  if (!el) return []
  const root = findComposerRoot(el)
  const seen = new Map<string, DetectedAttachment>()

  // Pass 1: scan visible text for filename patterns (in chips/pills)
  const text = root.textContent ?? ""
  const matches = text.match(FILENAME_RE) ?? []
  for (const raw of matches) {
    const filename = raw.trim()
    if (filename.length > 120) continue
    if (seen.has(filename)) continue
    // try to find a sibling size token near the filename
    const idx = text.indexOf(filename)
    const context = text.slice(idx, idx + filename.length + 40)
    const sizeMB = parseSizeMB(context)
    seen.set(filename, classifyAttachmentByExtension(filename, sizeMB))
  }

  // Pass 2: file-type badge chips. Find LEAF elements (no children) whose
  // visible text is exactly an extension token like "PDF" / "TXT" / "DOCX".
  // Each such leaf marks one chip. We use the badge node itself to anchor
  // counting — no risky walk-up that bleeds into sibling chips.
  const BADGE_RE =
    /^(PDF|DOCX?|TXT|RTF|MD|XLSX?|CSV|TSV|PPTX?|KEY|JSON|XML|YAML|YML|TOML|PY|JS|TS|JSX|TSX|JAVA|CPP|HTML?|CSS|GO|RS|RB|PHP|SWIFT|KT|MP4|MOV|AVI|WEBM|MKV|MP3|WAV|M4A|OGG|FLAC|ZIP|TAR|GZ|RAR|7Z|PNG|JPE?G|GIF|WEBP|SVG|BMP|TIFF?|HEIC)$/i
  // Collect badge nodes (any element whose trimmed text is exactly an
  // extension token). Then dedupe by chip container (the badge's parent or
  // grandparent), so multi-element chips count once.
  const badgeNodes: Array<{ ext: string; node: HTMLElement }> = []
  const allEls = root.querySelectorAll<HTMLElement>("*")
  allEls.forEach((el) => {
    const t = (el.textContent ?? "").trim()
    if (t.length === 0 || t.length > 6) return
    if (!BADGE_RE.test(t)) return
    // Skip if any child element also matches — we want the smallest matching
    // element so we don't double-count the chip via its ancestors.
    for (const child of Array.from(el.children)) {
      const ct = (child.textContent ?? "").trim()
      if (ct === t) return
    }
    badgeNodes.push({ ext: t.toLowerCase(), node: el })
  })

  // Dedupe by the chip container (closest ancestor that's a button-like or
  // attachment-like wrapper, or just the parent element).
  const chipContainers = new Set<HTMLElement>()
  const leafBadges: Array<{ ext: string; node: HTMLElement }> = []
  for (const b of badgeNodes) {
    const container = b.node.parentElement ?? b.node
    if (chipContainers.has(container)) continue
    chipContainers.add(container)
    leafBadges.push(b)
  }

  let chipIdx = 0
  for (const { ext, node } of leafBadges) {
    chipIdx++
    // Look at the closest chip-sized ancestor (parent or grandparent only).
    // Pull a candidate filename from its text; if it's noisy, fall back to a
    // synthetic name. Either way we get the count + type right.
    let filename: string | null = null
    let chipText = ""
    let chip: HTMLElement | null = node.parentElement
    for (let i = 0; i < 2 && chip; i++) {
      chipText = (chip.textContent ?? "").trim()
      // Strip badge token + size + line-count noise
      let candidate = chipText
        .replace(new RegExp(`\\b${ext}\\b`, "gi"), "")
        .replace(new RegExp(ext, "gi"), "")
        .replace(SIZE_RE, "")
        .replace(/\b\d+\s*lines?\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
      // Looks like a filename: short, mostly word chars, not multiple words of junk
      if (
        candidate.length > 0 &&
        candidate.length <= 60 &&
        candidate.split(" ").length <= 4 &&
        /^[\w\-. ()\[\]]+$/.test(candidate)
      ) {
        filename = /\.[a-z0-9]{1,5}$/i.test(candidate)
          ? candidate
          : `${candidate}.${ext}`
        break
      }
      chip = chip.parentElement
    }
    if (!filename) filename = `attachment_${chipIdx}.${ext}`
    // If we've already recorded this filename via Pass 1, skip
    if (seen.has(filename)) continue
    const sizeMB = chipText ? parseSizeMB(chipText) : undefined
    seen.set(filename, classifyAttachmentByExtension(filename, sizeMB))
  }

  // Pass 3: image previews. Only consider <img> tags whose nearest ancestor
  // <button>, <figure>, or container is structurally close to the textarea —
  // i.e., it shares a near-ancestor with the input element. We approximate by
  // filtering to images that are visually near the textarea (same offsetParent
  // chain, not in a sidebar/onboarding card).
  const imgs = root.querySelectorAll<HTMLImageElement>("img")
  let anonImageIdx = 0
  imgs.forEach((img) => {
    const w = img.naturalWidth || img.width || 0
    const h = img.naturalHeight || img.height || 0
    if (w < 32 && h < 32) return
    const src = img.src || ""
    if (/\.(svg)(\?|#|$)/i.test(src)) return
    // Skip if image is far from the textarea (e.g., onboarding cards below)
    const r = img.getBoundingClientRect()
    const tr = el.getBoundingClientRect()
    const verticalGap = Math.min(
      Math.abs(r.top - tr.bottom),
      Math.abs(r.bottom - tr.top)
    )
    if (verticalGap > 200) return // not part of the composer
    const inferred = src.match(/[\w\-]+\.(png|jpe?g|gif|webp|bmp|tiff?|heic)/i)
    const filename = inferred ? inferred[0] : `image_${++anonImageIdx}.png`
    if (seen.has(filename)) return
    seen.set(filename, classifyAttachmentByExtension(filename))
  })

  const result = Array.from(seen.values())
  if (result.length > 0) {
    console.log(`[Offprint] Detected ${result.length} attachments`, result)
  }
  return result
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
