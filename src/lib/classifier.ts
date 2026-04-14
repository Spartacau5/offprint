export type TaskType =
  | "text_generation"
  | "text_short"
  | "code_generation"
  | "code_debug"
  | "image_generation"
  | "file_creation"
  | "data_analysis"
  | "translation"
  | "summarization"
  | "brainstorm"
  | "conversation"
  | "editing"
  | "research"
  | "video_generation"
  | "unknown"

export type Confidence = "high" | "medium" | "low"

export type AttachmentType =
  | "image"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "code"
  | "data"
  | "video"
  | "audio"
  | "archive"
  | "unknown"

export interface DetectedAttachment {
  filename: string
  extension: string
  type: AttachmentType
  estimatedSizeMB: number
  estimatedTokens: number
  energyMultiplier: number
}

const EXT_MAP: Record<string, AttachmentType> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  svg: "image", bmp: "image", tiff: "image", tif: "image", heic: "image",
  pdf: "pdf",
  docx: "document", doc: "document", txt: "document", rtf: "document",
  md: "document", odt: "document",
  xlsx: "spreadsheet", xls: "spreadsheet", csv: "spreadsheet", tsv: "spreadsheet",
  py: "code", js: "code", ts: "code", jsx: "code", tsx: "code", java: "code",
  cpp: "code", c: "code", h: "code", hpp: "code", html: "code", css: "code",
  go: "code", rs: "code", rb: "code", php: "code", swift: "code", kt: "code",
  json: "data", xml: "data", yaml: "data", yml: "data", toml: "data",
  mp4: "video", mov: "video", avi: "video", webm: "video", mkv: "video",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio", flac: "audio",
  zip: "archive", tar: "archive", gz: "archive", rar: "archive", "7z": "archive"
}

export function classifyAttachmentByExtension(
  filename: string,
  sizeMB?: number
): DetectedAttachment {
  const ext = (filename.split(".").pop() ?? "").toLowerCase()
  const type = EXT_MAP[ext] ?? "unknown"
  const lower = filename.toLowerCase()

  let estimatedSizeMB = sizeMB ?? 0
  let estimatedTokens = 1000
  let energyMultiplier = 1

  switch (type) {
    case "image": {
      estimatedSizeMB = sizeMB ?? 2
      if (/screenshot|screen[ _-]?shot|img_/i.test(filename)) estimatedTokens = 800
      else if (/photo|portrait|landscape|dsc|raw/i.test(filename)) estimatedTokens = 1500
      else estimatedTokens = 1000
      energyMultiplier = 3
      break
    }
    case "pdf": {
      let pages: number
      if (/report|annual|whitepaper|thesis|manual|paper|book/i.test(lower)) {
        estimatedSizeMB = sizeMB ?? 5
        pages = sizeMB ? Math.round(sizeMB * 6) : 30
      } else if (/resume|cv|letter|invoice|receipt|bill/i.test(lower)) {
        estimatedSizeMB = sizeMB ?? 0.5
        pages = sizeMB ? Math.round(sizeMB * 6) : 2
      } else {
        estimatedSizeMB = sizeMB ?? 2
        pages = sizeMB ? Math.round(sizeMB * 6) : 10
      }
      estimatedTokens = Math.max(200, pages * 800)
      energyMultiplier = 1.5
      break
    }
    case "document": {
      const pages = sizeMB ? Math.round(sizeMB * 5) : 5
      estimatedSizeMB = sizeMB ?? 0.3
      estimatedTokens = Math.max(150, pages * 700)
      energyMultiplier = 1.2
      break
    }
    case "spreadsheet": {
      estimatedSizeMB = sizeMB ?? 1
      estimatedTokens = sizeMB ? Math.round(sizeMB * 5000) : 3000
      if (/data|export|database|dataset|log/i.test(lower)) estimatedTokens *= 2
      energyMultiplier = 2
      break
    }
    case "code": {
      const lines = 200
      estimatedSizeMB = sizeMB ?? 0.05
      estimatedTokens = lines * 10
      energyMultiplier = 1.5
      break
    }
    case "data": {
      estimatedSizeMB = sizeMB ?? 0.5
      estimatedTokens = sizeMB ? Math.round(sizeMB * 4000) : 2000
      energyMultiplier = 1.5
      break
    }
    case "video": {
      estimatedSizeMB = sizeMB ?? 20
      estimatedTokens = 5000
      energyMultiplier = 50
      break
    }
    case "audio": {
      estimatedSizeMB = sizeMB ?? 5
      estimatedTokens = 3000
      energyMultiplier = 10
      break
    }
    case "archive": {
      estimatedSizeMB = sizeMB ?? 5
      estimatedTokens = 3000
      energyMultiplier = 2
      break
    }
    default: {
      estimatedSizeMB = sizeMB ?? 0.5
      estimatedTokens = 500
      energyMultiplier = 1
    }
  }

  return {
    filename,
    extension: ext,
    type,
    estimatedSizeMB,
    estimatedTokens,
    energyMultiplier
  }
}

export function estimateAttachmentImpact(a: DetectedAttachment): {
  tokens: number
  energyMultiplier: number
} {
  return { tokens: a.estimatedTokens, energyMultiplier: a.energyMultiplier }
}

export interface ClassificationResult {
  taskType: TaskType
  confidence: Confidence
  estimatedOutputTokens: number
  energyMultiplier: number
  isIterative: boolean
  suggestedApproach: string | null
}

export const TASK_LABELS: Record<TaskType, string> = {
  text_generation: "Essay",
  text_short: "Quick Q",
  code_generation: "Code",
  code_debug: "Debug",
  image_generation: "Image Gen",
  file_creation: "File",
  data_analysis: "Data",
  translation: "Translate",
  summarization: "Summary",
  brainstorm: "Ideas",
  conversation: "Chat",
  editing: "Edit",
  research: "Research",
  video_generation: "Video Gen",
  unknown: "Prompt"
}

const has = (lower: string, needles: string[]) =>
  needles.some((n) => lower.includes(n))

const hasWord = (lower: string, words: string[]) =>
  words.some((w) => new RegExp(`\\b${w}\\b`).test(lower))

const startsWith = (lower: string, words: string[]) => {
  const trimmed = lower.trim()
  return words.some((w) => new RegExp(`^${w}\\b`).test(trimmed))
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const makeMe = (nouns: string[]): RegExp => {
  const alts = nouns.map(escapeRe).join("|")
  return new RegExp(
    `\\b(make|build|create|generate)\\s+me\\s+(a|an|the)\\s+(${alts})\\b`,
    "i"
  )
}

const IMAGE_NOUNS = [
  "image",
  "picture",
  "photo",
  "graphic",
  "logo",
  "illustration",
  "banner",
  "poster",
  "thumbnail",
  "icon",
  "artwork",
  "design",
  "meme",
  "drawing",
  "sketch",
  "visual"
]
const VIDEO_NOUNS = ["video", "clip", "animation", "gif", "reel", "movie"]
const FILE_NOUNS = [
  "document",
  "spreadsheet",
  "excel",
  "sheet",
  "csv",
  "presentation",
  "deck",
  "slides",
  "slide deck",
  "report",
  "resume",
  "cv",
  "cover letter",
  "template",
  "table",
  "chart",
  "diagram",
  "form",
  "invoice",
  "pdf",
  "docx",
  "word doc",
  "xlsx",
  "powerpoint",
  "pptx",
  "file"
]
const CODE_NOUNS = [
  "website",
  "web app",
  "webapp",
  "app",
  "mobile app",
  "bot",
  "script",
  "tool",
  "game",
  "calculator",
  "dashboard",
  "landing page",
  "component",
  "api",
  "function",
  "class",
  "program",
  "extension"
]
const DATA_NOUNS = ["graph", "visualization", "pivot table"]
const TEXT_NOUNS = [
  "blog post",
  "article",
  "essay",
  "story",
  "poem",
  "song",
  "draft",
  "outline",
  "plan",
  "list",
  "guide",
  "tutorial",
  "letter",
  "email"
]

const RE_IMAGE_MAKEME = makeMe(IMAGE_NOUNS)
const RE_VIDEO_MAKEME = makeMe(VIDEO_NOUNS)
const RE_FILE_MAKEME = makeMe(FILE_NOUNS)
const RE_CODE_MAKEME = makeMe(CODE_NOUNS)
const RE_DATA_MAKEME = makeMe(DATA_NOUNS)
const RE_TEXT_MAKEME = makeMe(TEXT_NOUNS)
const RE_DATA_SUMMARY_MAKEME =
  /\b(make|build|create|generate)\s+me\s+(a|an|the)\s+summary\s+of\s+(this|the|my)\s+data\b/i

// Broader verb+(determiner)?+noun matcher: covers "make another image",
// "create a new picture", "design another logo", "draw me a sketch", etc.
const verbNoun = (verbs: string[], nouns: string[]): RegExp => {
  const v = verbs.join("|")
  const n = nouns.map(escapeRe).join("|")
  return new RegExp(
    `\\b(${v})\\s+(?:me\\s+)?(?:a|an|the|another|new|one\\s+more|some)?\\s*(${n})\\b`,
    "i"
  )
}

const RE_IMAGE_VERBNOUN = verbNoun(
  ["make", "create", "generate", "build", "design", "draw", "render"],
  IMAGE_NOUNS
)
const RE_VIDEO_VERBNOUN = verbNoun(
  ["make", "create", "generate", "build", "render", "produce"],
  VIDEO_NOUNS
)
const RE_FILE_VERBNOUN = verbNoun(
  ["make", "create", "generate", "build", "produce", "draft"],
  FILE_NOUNS
)
const RE_CODE_VERBNOUN = verbNoun(
  ["make", "create", "generate", "build", "develop", "code"],
  CODE_NOUNS
)
const RE_DATA_VERBNOUN = verbNoun(
  ["make", "create", "generate", "build", "produce"],
  DATA_NOUNS
)
const RE_TEXT_VERBNOUN = verbNoun(
  ["write", "make", "create", "generate", "draft", "compose"],
  TEXT_NOUNS
)

const RULES: Array<{
  type: TaskType
  multiplier: number
  baseOutput: (inputTokens: number) => number
  iterative: boolean
  match: (lower: string, ctx: { inputTokens: number; chars: number }) => boolean
}> = [
  {
    type: "image_generation",
    multiplier: 60,
    baseOutput: () => 50,
    iterative: true,
    match: (l) =>
      has(l, [
        "generate an image",
        "create a picture",
        "create an image",
        "generate a picture",
        "design a logo",
        "make an illustration",
        "create art",
        "generate a photo",
        "create a photo",
        "dall-e",
        "dall e",
        "create a visual",
        "make a graphic",
        "generate artwork",
        "create a banner",
        "design a poster",
        "make a thumbnail",
        "create an icon",
        "midjourney",
        "stable diffusion"
      ]) ||
      hasWord(l, ["draw", "sketch"]) ||
      /\b(image|picture|photo|illustration|artwork) of\b/.test(l) ||
      RE_IMAGE_MAKEME.test(l) ||
      RE_IMAGE_VERBNOUN.test(l)
  },
  {
    type: "video_generation",
    multiplier: 200,
    baseOutput: () => 50,
    iterative: true,
    match: (l) =>
      has(l, [
        "generate a video",
        "create a video",
        "make a video",
        "video clip",
        "create an animation",
        "make an animation",
        "sora",
        "make a gif",
        "create a gif"
      ]) ||
      hasWord(l, ["animate"]) ||
      RE_VIDEO_MAKEME.test(l) ||
      RE_VIDEO_VERBNOUN.test(l)
  },
  {
    type: "file_creation",
    multiplier: 3,
    baseOutput: (it) => Math.max(400, it * 8),
    iterative: false,
    match: (l) =>
      has(l, [
        "create a pdf",
        "make a pdf",
        "generate a pdf",
        "generate a document",
        "create a docx",
        "create a doc",
        "make a word doc",
        "build a spreadsheet",
        "create a spreadsheet",
        "create an excel",
        "make a xlsx",
        "make an xlsx",
        "create a csv",
        "build a presentation",
        "create a presentation",
        "make a presentation",
        "create a pptx",
        "make a powerpoint",
        "create a powerpoint",
        "create slides",
        "make a deck",
        "export as",
        "save as file",
        "downloadable file"
      ]) ||
      (/(create|make|build|generate)\b.*\b(report|document|file)\b/.test(l) &&
        has(l, ["pdf", "docx", "xlsx", "pptx", "csv", "spreadsheet"])) ||
      RE_FILE_MAKEME.test(l) ||
      RE_FILE_VERBNOUN.test(l)
  },
  {
    type: "code_debug",
    multiplier: 1.5,
    baseOutput: (it) => Math.max(200, it * 3),
    iterative: true,
    match: (l) =>
      has(l, [
        "fix this",
        "debug",
        "what's wrong with",
        "whats wrong with",
        "not working",
        "issue with my code",
        "why does this",
        "troubleshoot",
        "stack trace",
        "throws an error",
        "throwing an error"
      ]) ||
      (hasWord(l, ["error", "bug"]) &&
        has(l, ["my", "code", "function", "script", "this"]))
  },
  {
    type: "code_generation",
    multiplier: 2,
    baseOutput: (it) => Math.max(300, it * 6),
    iterative: false,
    match: (l) =>
      has(l, [
        "write code",
        "create a script",
        "build an app",
        "code a",
        "write a function",
        "create a function",
        "create a component",
        "build a website",
        "make a webpage",
        "create an api",
        "write a program",
        "build me a tool",
        "create a bot",
        "write a class",
        "refactor"
      ]) ||
      hasWord(l, ["implement", "develop"]) ||
      /```/.test(l) ||
      /\b(in|using)\s+(python|javascript|typescript|react|node|go|rust|java|c\+\+|swift|kotlin|ruby|php)\b/.test(
        l
      ) ||
      RE_CODE_MAKEME.test(l) ||
      RE_CODE_VERBNOUN.test(l)
  },
  {
    type: "data_analysis",
    multiplier: 2.5,
    baseOutput: (it) => Math.max(300, it * 4),
    iterative: false,
    match: (l) =>
      has(l, [
        "analyze this data",
        "analyze the data",
        "create a chart",
        "make a graph",
        "make a chart",
        "visualize",
        "work with csv",
        "parse this",
        "data analysis",
        "pivot table",
        "calculate the"
      ]) ||
      hasWord(l, ["statistics"]) ||
      RE_DATA_MAKEME.test(l) ||
      RE_DATA_SUMMARY_MAKEME.test(l) ||
      RE_DATA_VERBNOUN.test(l)
  },
  {
    type: "research",
    multiplier: 1.5,
    baseOutput: (it) => Math.max(800, it * 8),
    iterative: false,
    match: (l) =>
      has(l, [
        "deep dive",
        "comprehensive",
        "thorough analysis",
        "compare and contrast",
        "in-depth",
        "in depth",
        "detailed breakdown"
      ]) || hasWord(l, ["research"])
  },
  {
    type: "summarization",
    multiplier: 0.5,
    baseOutput: (it) => Math.max(50, Math.round(it * 0.3)),
    iterative: false,
    match: (l) =>
      has(l, ["tldr", "tl;dr", "key points", "brief overview"]) ||
      hasWord(l, ["summarize", "summarise", "condense", "shorten"])
  },
  {
    type: "translation",
    multiplier: 1,
    baseOutput: (it) => Math.max(40, Math.round(it * 1.2)),
    iterative: false,
    match: (l) =>
      hasWord(l, ["translate"]) ||
      /\b(in|to|into)\s+(spanish|french|german|japanese|chinese|korean|italian|portuguese|russian|arabic|hindi|english)\b/.test(
        l
      )
  },
  {
    type: "editing",
    multiplier: 1,
    baseOutput: (it) => Math.max(100, Math.round(it * 1.5)),
    iterative: false,
    match: (l) =>
      has(l, ["fix grammar", "make it better"]) ||
      hasWord(l, [
        "rewrite",
        "improve",
        "proofread",
        "edit",
        "revise",
        "polish",
        "rephrase"
      ])
  },
  {
    type: "brainstorm",
    multiplier: 0.8,
    baseOutput: (it) => Math.max(200, it * 3),
    iterative: false,
    match: (l) =>
      has(l, ["options for", "what should i"]) ||
      hasWord(l, ["brainstorm", "ideas", "suggest", "recommend"])
  },
  {
    type: "text_generation",
    multiplier: 1,
    baseOutput: (it) => Math.max(300, it * 5),
    iterative: false,
    match: (l) =>
      hasWord(l, [
        "essay",
        "blog",
        "article",
        "story",
        "email",
        "letter",
        "report",
        "proposal",
        "draft",
        "compose"
      ]) ||
      has(l, ["create content", "blog post"]) ||
      /\bwrite\s+(me\s+)?(a|an|the)\b/.test(l) ||
      RE_TEXT_MAKEME.test(l) ||
      RE_TEXT_VERBNOUN.test(l)
  },
  {
    type: "text_short",
    multiplier: 0.5,
    baseOutput: () => 150,
    iterative: false,
    match: (l, { chars }) => {
      if (chars >= 80) return false
      if (l.includes("?")) return true
      return startsWith(l, [
        "what",
        "who",
        "when",
        "where",
        "how",
        "why",
        "is",
        "are",
        "can",
        "does",
        "do"
      ])
    }
  }
]

function applySizeModifiers(
  baseOutput: number,
  lower: string
): { tokens: number; explicit: boolean } {
  let out = baseOutput
  let explicit = false

  const wordsMatch = lower.match(/(\d+)\s*words?/)
  const pagesMatch = lower.match(/(\d+)\s*pages?/)
  if (wordsMatch) {
    out = Math.round(parseInt(wordsMatch[1], 10) * 1.3)
    explicit = true
  } else if (pagesMatch) {
    out = Math.round(parseInt(pagesMatch[1], 10) * 250 * 1.3)
    explicit = true
  }

  if (
    has(lower, ["one paragraph", "one sentence", "one line", "single sentence"])
  ) {
    out = Math.min(out, 100)
    explicit = true
  }

  if (!explicit) {
    if (has(lower, ["short", "brief", "quick", "simple", "concise"])) {
      out = Math.round(out * 0.4)
    } else if (
      has(lower, ["full", "complete", "entire", "comprehensive", "detailed", "thorough"])
    ) {
      out = Math.round(out * 1.5)
    }
  }

  return { tokens: Math.max(20, out), explicit }
}

const REFERENCES_PRIOR = (l: string) =>
  /\b(that|this|the above|like i said|as i mentioned|same as before)\b/.test(l)

export function classifyPrompt(
  text: string,
  messageCount: number
): ClassificationResult {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()
  const chars = trimmed.length
  const inputTokens = Math.max(1, Math.ceil(chars / 4))

  if (chars === 0) {
    return {
      taskType: "unknown",
      confidence: "low",
      estimatedOutputTokens: 0,
      energyMultiplier: 1,
      isIterative: false,
      suggestedApproach: null
    }
  }

  for (const rule of RULES) {
    if (rule.match(lower, { inputTokens, chars })) {
      const base = rule.baseOutput(inputTokens)
      const sized = applySizeModifiers(base, lower)
      const confidence: Confidence = sized.explicit ? "high" : "medium"
      return {
        taskType: rule.type,
        confidence:
          rule.type === "text_short" || rule.type === "translation"
            ? "high"
            : confidence,
        estimatedOutputTokens: sized.tokens,
        energyMultiplier: rule.multiplier,
        isIterative: rule.iterative,
        suggestedApproach: null
      }
    }
  }

  if (chars < 40 && (REFERENCES_PRIOR(lower) || messageCount > 0)) {
    return {
      taskType: "conversation",
      confidence: "medium",
      estimatedOutputTokens: 200,
      energyMultiplier: 0.5,
      isIterative: false,
      suggestedApproach: null
    }
  }

  return {
    taskType: "unknown",
    confidence: "low",
    estimatedOutputTokens: Math.max(150, inputTokens * 3),
    energyMultiplier: 1,
    isIterative: false,
    suggestedApproach: null
  }
}
