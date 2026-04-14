import type { ClassificationResult, TaskType } from "./classifier"

export interface SmartSuggestion {
  message: string
  taskType: TaskType
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

export function smartAnalyze(
  text: string,
  classification: ClassificationResult
): SmartSuggestion {
  const templates = TEMPLATES[classification.taskType] ?? TEMPLATES.unknown
  const idx = Math.abs(hashString(text.slice(0, 80))) % templates.length
  return {
    taskType: classification.taskType,
    message: templates[idx](text)
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
