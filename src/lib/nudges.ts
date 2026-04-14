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
    id: "REPEAT_ITERATION",
    priority: 2,
    condition: ({ messageCount }) => messageCount >= 4,
    message: ({ messageCount }) =>
      `You've sent ${messageCount} messages. Try consolidating remaining feedback into one detailed prompt to reduce back-and-forth.`,
    iconName: "refresh"
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
