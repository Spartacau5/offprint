// One-shot script: renders the Offprint leaf icon SVG to assets/icon.png
// at 1024x1024 (Plasmo auto-generates 16/32/48/128 from this).
//
//   node scripts/build-icon.mjs
import { writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = resolve(__dirname, "..", "assets", "icon.png")
const SIZE = 1024
const PAD = Math.round(SIZE * 0.18)
const INNER = SIZE - PAD * 2

// Background: rounded square (~22% radius) in #111827.
// Leaf: filled emerald path centered, with a subtle lighter accent on the
// upper-right side for dimension. Path is normalized to a 24x24 viewBox and
// scaled to fill the inner padded area.
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="55%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${Math.round(SIZE * 0.22)}" ry="${Math.round(SIZE * 0.22)}" fill="#111827"/>
  <g transform="translate(${PAD} ${PAD}) scale(${INNER / 24})">
    <path
      d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c1.4 9.3-1.5 17.04-8.2 17.04Z"
      fill="url(#leafGrad)"
    />
    <path
      d="M2 21c0-3 1.85-5.36 5.08-6"
      stroke="#10B981"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
writeFileSync(out, png)
console.log(`Wrote ${out} (${SIZE}x${SIZE})`)
