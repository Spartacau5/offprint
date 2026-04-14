import type {
  ClassificationResult,
  DetectedAttachment,
  TaskType
} from "./classifier"

export interface SmartSuggestion {
  message: string
  taskType: TaskType
}

export interface SmartContext {
  text: string
  classification: ClassificationResult
  attachments?: DetectedAttachment[]
  messageCount?: number
  recentTaskTypes?: TaskType[]
}

const TOPIC_STOPWORDS = new Set([
  "a", "an", "the", "of", "for", "about", "on", "to", "in", "with",
  "and", "or", "but", "me", "my", "your", "our", "their", "his", "her",
  "please", "can", "could", "would", "should", "will", "shall",
  "you", "i", "we", "they", "is", "are", "was", "were", "be", "been",
  "this", "that", "these", "those", "it", "its",
  "write", "create", "make", "generate", "build", "give", "draft",
  "compose", "produce", "design", "develop", "do", "have", "has",
  "use", "using", "used", "first", "then", "now", "so", "if", "when",
  "while", "after", "before", "any", "some", "all", "more", "less",
  "most", "much", "many", "few", "very", "really", "just", "also",
  "however", "therefore", "best", "good", "great", "nice", "quick",
  "simple", "easy", "want", "need", "like", "feel", "think", "know",
  "get", "got", "take", "let", "help", "show", "tell", "as", "by",
  "from", "out", "up", "down", "off", "into", "over", "under",
  "such", "than", "too", "only", "even", "still"
])

function extractTopic(text: string, max = 3): string | null {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TOPIC_STOPWORDS.has(w))
  if (tokens.length === 0) return null
  return tokens.slice(0, max).join(" ")
}

function extractLengthHint(text: string): string | null {
  const w = text.match(/(\d+)\s*words?/i)
  if (w) return `${w[1]} words`
  const p = text.match(/(\d+)\s*pages?/i)
  if (p) return `${p[1]} pages`
  return null
}

const TEMPLATES: Record<TaskType, Array<(text: string) => string>> = {
  text_generation: [
    (t) => {
      const topic = extractTopic(t)
      const len = extractLengthHint(t)
      const lead = topic ? `Ask for an outline on "${topic}" first` : "Ask for an outline first"
      const tail = len
        ? `This avoids rewriting ${len} if the angle is wrong.`
        : "This avoids rewriting a long draft if the angle is wrong."
      return `${lead} (~5 bullet points), then expand each section. ${tail}`
    },
    (t) => {
      const topic = extractTopic(t)
      const subject = topic ? `on "${topic}"` : "for this piece"
      return `Specify audience, tone, and 3 must-cover points ${subject}. A focused brief beats two regenerations.`
    },
    () =>
      "Request the introduction and conclusion only first. If those land, the body almost writes itself in one shot."
  ],
  text_short: [
    () =>
      "If you only need a quick fact, search engines answer in milliseconds with no AI compute. Use AI when you need synthesis."
  ],
  code_generation: [
    (t) => {
      const topic = extractTopic(t)
      const subject = topic ? `for "${topic}"` : "for this code"
      return `Specify language, framework version, and one constraint (e.g., 'no external deps') ${subject} before generating.`
    },
    () =>
      "Ask for the function signature and a 3-line plan first. Approve the approach, then request the implementation.",
    () =>
      "Provide the input/output shape and one example case. The model nails the implementation in 1 attempt instead of 3."
  ],
  code_debug: [
    () =>
      "Paste the exact error message, the failing line, and one line of context above and below. Targeted debugging finishes in 1 round.",
    () =>
      "State what you expected to happen vs what happened. That framing alone resolves most bugs without back-and-forth."
  ],
  image_generation: [
    (t) => {
      const topic = extractTopic(t, 4)
      const subject = topic ? `For "${topic}", specify` : "Specify"
      return `${subject} style (photorealistic, watercolor, 3D), aspect ratio, and mood. Each regeneration costs as much as ~60 text prompts.`
    },
    () =>
      "Describe lighting, composition, and color palette up front. Vague image prompts average 4-6 regenerations; specific ones land in 1-2."
  ],
  video_generation: [
    () =>
      "Storyboard the key frames in text first. Generating, then re-generating video at 200x text cost is the most expensive AI mistake.",
    () =>
      "Describe shot duration, camera motion, subject, and transitions. Vague video prompts almost always need full regeneration."
  ],
  file_creation: [
    (t) => {
      const topic = extractTopic(t)
      const subject = topic ? `for "${topic}"` : ""
      return `Ask for the content ${subject}as plain text first. Once you approve it, request the file conversion — same result, half the compute.`.replace(
        / +/g,
        " "
      )
    },
    () =>
      "Iterate on the content in chat (cheap), then request file generation only at the end (expensive). Don't pay file overhead per draft."
  ],
  data_analysis: [
    () =>
      "Share schema and 5 sample rows first; ask for an analysis plan. Run the actual analysis only after the plan is right.",
    () =>
      "Specify the question you want answered, not 'analyze this'. 'Analyze' produces verbose output that's mostly skimmed."
  ],
  translation: [
    () =>
      "Batch all phrases into a single numbered list. One translation prompt with 10 items costs less than 10 separate prompts."
  ],
  summarization: [
    () =>
      "State the audience and target length (e.g., '3 bullets for an exec'). Summaries without constraints over-produce by 2-3x."
  ],
  brainstorm: [
    () =>
      "Ask for 5 ideas with a one-line rationale each, not 20 ideas. Quality beats quantity and uses less compute."
  ],
  conversation: [
    () =>
      "Add the missing detail in a single message rather than a thread of clarifications. Each round-trip recomputes prior context."
  ],
  editing: [
    () =>
      "Quote only the sentences that need editing and describe the change. Re-submitting the full text re-processes everything."
  ],
  research: [
    () =>
      "Ask for a structured comparison table with 3 sources first. Then deep-dive only on the cells that surprise you."
  ],
  unknown: [
    () =>
      "Add 1 sentence of context (what, why, format) before sending. A clearer prompt usually halves the total tokens used."
  ]
}

// ---- Contextual rules (evaluated before the per-task templates) ----

type ContextRule = {
  id: string
  match: (ctx: SmartContext) => boolean
  build: (ctx: SmartContext) => string
}

const lower = (s: string) => s.toLowerCase()
const referencesAttachment = (text: string): boolean => {
  const refs = [
    "this file",
    "attached",
    "attachment",
    "the document",
    "this image",
    "the pdf",
    "the file",
    "the image",
    "this pdf",
    "this doc",
    "these pdfs",
    "these files",
    "these images",
    "analyze this",
    "look at this",
    "read this",
    "based on this",
    "based on these",
    "from this"
  ]
  const l = lower(text)
  return refs.some((r) => l.includes(r))
}

const fmtTokens = (n: number) =>
  n >= 1000 ? `~${Math.round(n / 100) / 10}k` : `~${n}`

const CONTEXT_RULES: ContextRule[] = [
  // Highest priority: attachment-related (these dwarf text cost)
  {
    id: "image_plus_image_gen",
    match: ({ classification, attachments }) =>
      classification.taskType === "image_generation" &&
      !!attachments?.some((a) => a.type === "image"),
    build: () =>
      "Reference image + image generation is one of the most expensive combinations. Describe exactly what to change about the reference (subject, style, composition) — vague requests average 4-6 regenerations."
  },
  {
    id: "multiple_heavy_attachments",
    match: ({ attachments }) => {
      if (!attachments || attachments.length < 2) return false
      const total = attachments.reduce((s, a) => s + a.estimatedTokens, 0)
      return total >= 10000
    },
    build: ({ attachments }) => {
      const total = (attachments ?? []).reduce(
        (s, a) => s + a.estimatedTokens,
        0
      )
      return `Your ${attachments?.length} attachments add ${fmtTokens(total)} tokens. Tell the AI which file(s) matter and which sections to focus on — every revision otherwise re-processes all of them.`
    }
  },
  {
    id: "many_attachments",
    match: ({ attachments }) => (attachments?.length ?? 0) >= 3,
    build: ({ attachments }) =>
      `${attachments?.length} attachments multiply processing cost. Process them one at a time, or pick the primary file and reference the others only when needed.`
  },
  {
    id: "large_pdf",
    match: ({ attachments }) =>
      !!attachments?.some(
        (a) => a.type === "pdf" && a.estimatedTokens > 5000
      ),
    build: ({ attachments }) => {
      const pdf = attachments?.find(
        (a) => a.type === "pdf" && a.estimatedTokens > 5000
      )
      const name = pdf?.filename ? `"${pdf.filename}"` : "the PDF"
      return `${name} is large. Specify which pages or sections to focus on (e.g., "summarize chapters 2-3") — feeding the whole PDF on every turn wastes most of those tokens.`
    }
  },
  {
    id: "unnecessary_attachment",
    match: ({ attachments, classification, text }) => {
      if (!attachments?.length) return false
      const t = classification.taskType
      const casual =
        t === "conversation" || t === "text_short" || t === "brainstorm"
      return casual && !referencesAttachment(text)
    },
    build: () =>
      "Your prompt doesn't reference the attached file. Unused attachments still get processed — remove them, or add a sentence about what to use them for."
  },
  {
    id: "video_attachment",
    match: ({ attachments }) =>
      !!attachments?.some((a) => a.type === "video"),
    build: () =>
      "Video attachments are the most expensive input type (~50x text). If you need a specific moment, describe the timestamp and what to look for instead of asking general questions."
  },
  {
    id: "audio_attachment",
    match: ({ attachments }) =>
      !!attachments?.some((a) => a.type === "audio"),
    build: () =>
      "Audio gets transcribed before analysis. If you already have a transcript, paste the relevant excerpt — it costs a fraction of the audio processing."
  },
  {
    id: "spreadsheet_attachment",
    match: ({ attachments }) =>
      !!attachments?.some((a) => a.type === "spreadsheet"),
    build: () =>
      "For spreadsheets, name the columns or rows that matter and the exact question you want answered. Otherwise the model parses every cell — most of which you don't need."
  },
  // Light attachment + clear task: reference best-practice
  {
    id: "attachment_with_text_gen",
    match: ({ classification, attachments }) =>
      (attachments?.length ?? 0) > 0 &&
      classification.taskType === "text_generation",
    build: ({ attachments, text }) => {
      const types = Array.from(new Set((attachments ?? []).map((a) => a.type)))
      const noun = types.includes("pdf")
        ? "PDFs"
        : types.includes("image")
          ? "images"
          : "files"
      const topic = extractTopic(text)
      const subject = topic ? `on "${topic}"` : "for this piece"
      return `Tell the AI which parts of the ${noun} should drive the essay ${subject} (key arguments? specific data?). This narrows the input and avoids re-reading everything on revisions.`
    }
  },

  // Iteration / session signals
  {
    id: "long_iteration",
    match: ({ messageCount }) => (messageCount ?? 0) >= 5,
    build: ({ messageCount }) =>
      `You've sent ${messageCount} messages. Consolidate the remaining feedback into one detailed prompt — each round-trip re-processes the prior context.`
  },
  {
    id: "batch_translations",
    match: ({ classification, recentTaskTypes }) =>
      classification.taskType === "translation" &&
      (recentTaskTypes?.filter((t) => t === "translation").length ?? 0) >= 2,
    build: () =>
      "You've been translating one-at-a-time. Batch them into a numbered list in a single prompt — same result, a fraction of the per-request overhead."
  },

  // Prompt-shape signals
  {
    id: "multi_request",
    match: ({ text, classification }) => {
      if (classification.energyMultiplier < 1) return false
      const l = lower(text)
      return (
        text.length > 100 &&
        ["and also", "plus also", "additionally", "while you're at it", "oh and", "one more thing"].some(
          (k) => l.includes(k)
        )
      )
    },
    build: () =>
      "This prompt asks for multiple things at once. Splitting it gives better answers per part and lets you skip the ones you don't need."
  },
  {
    id: "long_prompt",
    match: ({ text }) => Math.ceil(text.length / 4) > 500,
    build: () =>
      "This prompt is long. Try a short statement of your goal followed by a bulleted list of requirements — the model usually ignores the redundant context anyway."
  },
  {
    id: "vague_short",
    match: ({ text, classification }) =>
      text.trim().length > 0 &&
      text.trim().length < 30 &&
      classification.confidence === "low" &&
      classification.taskType === "unknown",
    build: () =>
      "Add one sentence on format and one example of a good result. Two minutes of context here saves 2-3 follow-up rounds."
  }
]

export function smartAnalyze(
  textOrCtx: string | SmartContext,
  classification?: ClassificationResult
): SmartSuggestion {
  const ctx: SmartContext =
    typeof textOrCtx === "string"
      ? { text: textOrCtx, classification: classification! }
      : textOrCtx

  // Try contextual rules first (highest signal wins)
  for (const rule of CONTEXT_RULES) {
    try {
      if (rule.match(ctx)) {
        return {
          taskType: ctx.classification.taskType,
          message: rule.build(ctx)
        }
      }
    } catch {
      // ignore broken rule, continue
    }
  }

  // Fallback: task-type template
  const templates =
    TEMPLATES[ctx.classification.taskType] ?? TEMPLATES.unknown
  const idx = Math.abs(hashString(ctx.text.slice(0, 80))) % templates.length
  return {
    taskType: ctx.classification.taskType,
    message: templates[idx](ctx.text)
  }
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return h
}
