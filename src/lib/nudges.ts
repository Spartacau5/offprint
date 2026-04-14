import type {
  ClassificationResult,
  DetectedAttachment,
  TaskType
} from "./classifier"

export type NudgePriority = 1 | 2 | 3
export type NudgeIcon =
  | "lightbulb"
  | "target"
  | "file"
  | "search"
  | "refresh"
  | "scissors"

export interface NudgeContext {
  text: string
  tokens: number
  charCount: number
  messageCount: number
  classification: ClassificationResult
  recentTaskTypes?: TaskType[]
  attachments?: DetectedAttachment[]
}

export interface NudgeRule {
  id: string
  priority: NudgePriority
  taskSpecific?: boolean
  condition: (ctx: NudgeContext) => boolean
  message: string | ((ctx: NudgeContext) => string)
  iconName: NudgeIcon
  conflictsWith?: string[]
}

export interface Nudge {
  id: string
  priority: NudgePriority
  taskSpecific: boolean
  message: string
  iconName: NudgeIcon
  conflictsWith: string[]
}

const lower = (t: string) => t.toLowerCase()
const containsAny = (text: string, needles: string[]) => {
  const l = lower(text)
  return needles.some((n) => l.includes(n))
}
const hasLengthSpec = (text: string) =>
  containsAny(text, [
    "word",
    "sentence",
    "paragraph",
    "line",
    "page",
    "brief",
    "short",
    "concise",
    "detailed"
  ])

export const NUDGE_RULES: NudgeRule[] = [
  {
    id: "LONG_PROMPT",
    priority: 3,
    condition: ({ tokens }) => tokens > 500,
    message:
      "Long prompts often contain redundant context. Try stating your goal in 1-2 sentences, then listing specific requirements.",
    iconName: "lightbulb",
    conflictsWith: ["VAGUE_PROMPT"]
  },
  {
    id: "VAGUE_PROMPT",
    priority: 1,
    condition: ({ charCount, classification }) =>
      charCount > 0 &&
      charCount < 40 &&
      classification.confidence === "low" &&
      classification.taskType === "unknown",
    message:
      "This prompt is ambiguous. Adding what format you want and one example of a good result can save 2-3 follow-up rounds.",
    iconName: "search",
    conflictsWith: ["LONG_PROMPT"]
  },
  {
    id: "MULTI_REQUEST",
    priority: 2,
    condition: ({ text, tokens }) =>
      tokens > 250 &&
      containsAny(text, [
        "and also",
        "plus also",
        "additionally",
        "while you're at it",
        "while youre at it",
        "oh and",
        "btw also",
        "one more thing"
      ]),
    message:
      "Multi-part prompts often get uneven quality. Splitting into focused requests gives better results with less total compute.",
    iconName: "scissors"
  },
  {
    id: "FULL_GENERATION_SPLIT",
    priority: 3,
    taskSpecific: true,
    condition: ({ text, classification }) =>
      classification.taskType === "text_generation" &&
      classification.estimatedOutputTokens > 1500 &&
      containsAny(text, ["full", "complete", "entire", "comprehensive"]),
    message:
      "For long content, ask for an outline first, approve it, then ask for the full draft. This avoids expensive rewrites.",
    iconName: "target"
  },
  {
    id: "IMAGE_AWARENESS",
    priority: 3,
    taskSpecific: true,
    condition: ({ classification }) =>
      classification.taskType === "image_generation",
    message:
      "Image generation uses ~60x more energy than text. Be specific about style, composition, and mood to get it right in fewer attempts.",
    iconName: "lightbulb"
  },
  {
    id: "VIDEO_AWARENESS",
    priority: 3,
    taskSpecific: true,
    condition: ({ classification }) =>
      classification.taskType === "video_generation",
    message:
      "Video generation is the most compute-intensive AI task (~200x text). Describe your vision precisely — storyboard key frames in text first.",
    iconName: "lightbulb"
  },
  {
    id: "FILE_CREATION_TIP",
    priority: 2,
    taskSpecific: true,
    condition: ({ classification }) =>
      classification.taskType === "file_creation",
    message:
      "File generation adds overhead beyond the text itself. Consider asking for the content first, then requesting the file format only when satisfied.",
    iconName: "file"
  },
  {
    id: "CODE_PLANNING",
    priority: 2,
    taskSpecific: true,
    condition: ({ tokens, classification }) =>
      classification.taskType === "code_generation" && tokens > 200,
    message:
      "For complex code, ask the AI to outline its approach first. Catching a wrong direction early saves multiple regeneration cycles.",
    iconName: "target"
  },
  {
    id: "CODE_DEBUG_CONTEXT",
    priority: 1,
    taskSpecific: true,
    condition: ({ tokens, classification }) =>
      classification.taskType === "code_debug" && tokens < 100,
    message:
      "Include the error message and relevant code snippet. Debugging with full context usually resolves in 1 round instead of 3-4.",
    iconName: "search"
  },
  {
    id: "SUMMARIZE_INSTEAD",
    priority: 1,
    taskSpecific: true,
    condition: ({ tokens, classification }) =>
      classification.taskType === "research" && tokens > 400,
    message:
      "For research tasks, ask for a summary with source references first. You can then deep-dive into only the areas that matter.",
    iconName: "lightbulb"
  },
  {
    id: "SPECIFY_LENGTH",
    priority: 1,
    taskSpecific: true,
    condition: ({ text, classification }) => {
      const t = classification.taskType
      if (
        t !== "text_generation" &&
        t !== "code_generation" &&
        t !== "research"
      )
        return false
      return !hasLengthSpec(text)
    },
    message:
      "Specifying your desired length (e.g., '200 words' or '3 paragraphs') prevents over-generation and saves compute.",
    iconName: "target"
  },
  {
    id: "BATCH_TRANSLATIONS",
    priority: 1,
    taskSpecific: true,
    condition: ({ classification, messageCount, recentTaskTypes }) =>
      classification.taskType === "translation" &&
      messageCount >= 2 &&
      !!recentTaskTypes &&
      recentTaskTypes.filter((t) => t === "translation").length >= 2,
    message:
      "Batch your translations into a single prompt — sending them one at a time adds overhead per request.",
    iconName: "scissors"
  },
  {
    id: "DATA_SCOPE",
    priority: 2,
    taskSpecific: true,
    condition: ({ text, classification }) =>
      classification.taskType === "data_analysis" &&
      containsAny(text, ["all", "everything", "entire dataset"]),
    message:
      "Analyzing large datasets is compute-heavy. Start with a sample or summary stats, then drill into specific areas.",
    iconName: "lightbulb"
  },
  {
    id: "LARGE_PDF",
    priority: 2,
    taskSpecific: true,
    condition: ({ attachments }) =>
      !!attachments?.some((a) => a.type === "pdf" && a.estimatedTokens > 5000),
    message:
      "Large PDFs are token-heavy. If you only need specific sections, try telling the AI which pages or topics to focus on.",
    iconName: "file"
  },
  {
    id: "MULTIPLE_ATTACHMENTS",
    priority: 2,
    taskSpecific: true,
    condition: ({ attachments }) => (attachments?.length ?? 0) >= 3,
    message:
      "Multiple attachments multiply processing cost. Consider handling them one at a time or specifying which one to focus on first.",
    iconName: "scissors"
  },
  {
    id: "IMAGE_PLUS_GENERATION",
    priority: 3,
    taskSpecific: true,
    condition: ({ attachments, classification }) =>
      classification.taskType === "image_generation" &&
      !!attachments?.some((a) => a.type === "image"),
    message:
      "Uploading a reference image with an image generation request is one of the most compute-heavy combinations. Be very specific about what to change.",
    iconName: "lightbulb"
  },
  {
    id: "UNNECESSARY_ATTACHMENT",
    priority: 1,
    taskSpecific: true,
    condition: ({ attachments, classification, text }) => {
      if (!attachments || attachments.length === 0) return false
      const t = classification.taskType
      if (t !== "conversation" && t !== "text_short" && t !== "brainstorm")
        return false
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
        "analyze this",
        "look at this",
        "read this",
        "based on this",
        "from this"
      ]
      const lower = text.toLowerCase()
      return !refs.some((r) => lower.includes(r))
    },
    message:
      "You have a file attached but your prompt doesn't seem to reference it. Unused attachments still get processed — remove it if unneeded.",
    iconName: "search"
  },
  {
    id: "GOOGLE_IT",
    priority: 2,
    taskSpecific: true,
    condition: ({ text, charCount, classification }) => {
      if (charCount >= 80) return false
      const t = classification.taskType
      if (t !== "text_short" && t !== "conversation") return false
      const l = lower(text)
      const lookups = [
        "what is",
        "what's",
        "whats ",
        "who is",
        "who's",
        "whos ",
        "when did",
        "when was",
        "when is",
        "where is",
        "where's",
        "wheres ",
        "how old is",
        "how tall is",
        "how much is",
        "what year",
        "what time",
        "define ",
        "meaning of",
        "capital of",
        "population of",
        "weather in",
        "convert ",
        "how many",
        "what does",
        "translate "
      ]
      if (!lookups.some((p) => l.includes(p))) return false
      const blockers = [
        "explain in detail",
        "help me understand",
        "write",
        "create",
        "analyze",
        "compare in depth",
        "why does"
      ]
      return !blockers.some((p) => l.includes(p))
    },
    message:
      "A quick Google search might answer this faster — and uses a fraction of the energy of an AI query.",
    iconName: "search"
  },
  {
    id: "DIY_TASK",
    priority: 1,
    taskSpecific: true,
    condition: ({ text }) => {
      const l = lower(text)
      return [
        "remind me to",
        "set a timer",
        "set an alarm",
        "add to my calendar",
        "what's on my schedule",
        "whats on my schedule",
        "send an email to",
        "create a reminder",
        "add a note"
      ].some((p) => l.includes(p))
    },
    message:
      "Your device can handle this natively — try your calendar, reminders, or assistant app. Zero compute needed.",
    iconName: "lightbulb"
  },
  {
    id: "SIMPLE_MATH",
    priority: 1,
    taskSpecific: true,
    condition: ({ text, charCount }) => {
      if (charCount >= 60) return false
      const l = lower(text)
      // Pure math expression
      if (/^[\d\s+\-*/x().,%=?$£€¥]+$/i.test(text.trim())) return true
      const patterns = [
        "calculate",
        "what is",
        "what's"
      ]
      const ops = [
        " plus ",
        " minus ",
        " times ",
        " divided by ",
        " percentage of ",
        " percent of ",
        " % of ",
        " in usd",
        " in eur",
        " in gbp",
        " to celsius",
        " to fahrenheit",
        " to kg",
        " to lbs",
        " to km",
        " to miles"
      ]
      if (
        patterns.some((p) => l.includes(p)) &&
        (ops.some((o) => l.includes(o)) ||
          /\d+\s*[+\-*/x]\s*\d+/.test(l))
      ) {
        return true
      }
      return false
    },
    message:
      "Your phone's calculator or a quick search handles this instantly with a fraction of the energy.",
    iconName: "scissors"
  },
  {
    id: "CONFIRM_BEFORE_BUILD",
    priority: 3,
    taskSpecific: true,
    condition: ({ text, tokens, classification }) => {
      const t = classification.taskType
      if (
        t !== "code_generation" &&
        t !== "file_creation" &&
        t !== "image_generation"
      )
        return false
      if (tokens <= 150) return false
      const l = lower(text)
      const confirming = [
        "go ahead",
        "yes build it",
        "confirmed",
        "looks good, now create",
        "looks good now create",
        "proceed"
      ]
      if (confirming.some((p) => l.includes(p))) return false
      const commaCount = (text.match(/,/g) ?? []).length
      const hasMulti =
        commaCount >= 3 ||
        /\b(with|that includes|which has|make sure it|it should)\b/.test(l) ||
        /^\s*\d+\.\s/m.test(text)
      return hasMulti
    },
    message:
      "Complex builds often need revisions. Ask the AI to outline its plan first — confirming direction before generation can save 2-3 full rebuilds.",
    iconName: "target",
    conflictsWith: ["FULL_GENERATION_SPLIT", "CODE_PLANNING"]
  },
  {
    id: "OVERLY_SPECIFIC_IMAGE",
    priority: 2,
    taskSpecific: true,
    condition: ({ tokens, classification }) =>
      classification.taskType === "image_generation" && tokens > 200,
    message:
      "Detailed image prompts often miss on the first try. Start with the core concept in 1-2 sentences, then refine — each image generation uses as much energy as 60 text responses.",
    iconName: "lightbulb",
    conflictsWith: ["IMAGE_AWARENESS"]
  },
  {
    id: "EDITING_SCOPE",
    priority: 1,
    taskSpecific: true,
    condition: ({ tokens, classification }) =>
      classification.taskType === "editing" && tokens > 300,
    message:
      "For edits, highlight exactly what needs changing rather than re-submitting the full text. Targeted edits use a fraction of the compute.",
    iconName: "scissors"
  }
]

export function evaluateNudges(ctx: NudgeContext, max = 2): Nudge[] {
  const matching = NUDGE_RULES.filter((r) => {
    try {
      return r.condition(ctx)
    } catch {
      return false
    }
  })

  const taskSpecificMatches = matching.filter((r) => r.taskSpecific)
  const generic = matching.filter((r) => !r.taskSpecific)

  const ordered =
    ctx.classification.confidence === "high" && taskSpecificMatches.length > 0
      ? [...taskSpecificMatches, ...generic]
      : matching.slice()

  ordered.sort((a, b) => b.priority - a.priority)

  const picked: NudgeRule[] = []
  for (const rule of ordered) {
    if (picked.length >= max) break
    const conflicts = rule.conflictsWith ?? []
    if (picked.some((p) => conflicts.includes(p.id))) continue
    if (
      picked.some((p) => (p.conflictsWith ?? []).includes(rule.id))
    )
      continue
    picked.push(rule)
  }

  return picked.map((r) => ({
    id: r.id,
    priority: r.priority,
    taskSpecific: !!r.taskSpecific,
    iconName: r.iconName,
    message: typeof r.message === "function" ? r.message(ctx) : r.message,
    conflictsWith: r.conflictsWith ?? []
  }))
}
