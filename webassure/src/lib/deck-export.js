import { H, THEMES, W, buildSlides } from './deck.mjs'

const file = (mode) => `WebAssure-Pitch-Deck-${THEMES[mode].label}`
export const SHIELD = [
  'M8.9 16.2 C15.3 16 21.6 14 27.1 11.1 C28.3 10.5 29.2 11.1 29.2 12.6 V35.8 H12 C10.1 31.2 8.9 26.8 8.9 22 Z',
  'M55.1 16.2 C48.7 16 42.4 14 36.9 11.1 C35.7 10.5 34.8 11.1 34.8 12.6 V35.8 H52 C53.9 31.2 55.1 26.8 55.1 22 Z',
  'M16.9 41.6 H29.2 V51.8 C29.2 53.3 28.1 54 26.9 53.2 C22.7 50.3 19.7 47.2 16.9 43.3 Z',
  'M47.1 41.6 H34.8 V51.8 C34.8 53.3 35.9 54 37.1 53.2 C41.3 50.3 44.3 47.2 47.1 43.3 Z',
]

const inch = (px) => px / 96
const pt = (px) => px * 0.75

function shieldImage(color) {
  const canvas = document.createElement('canvas')
  canvas.width = 1040
  canvas.height = 960
  const ctx = canvas.getContext('2d')
  ctx.scale(20, 20)
  ctx.translate(-6, -8)
  ctx.fillStyle = ctx.strokeStyle = `#${color}`
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  for (const d of SHIELD) {
    const path = new Path2D(d)
    ctx.fill(path)
    ctx.stroke(path)
  }
  return canvas.toDataURL('image/png')
}

// The wordmark is a picture in the PPT so the brand never falls back to another font.
function wordmarkImage(size, color) {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-archivo').trim()
  const font = `600 semi-expanded ${size * 4}px ${family}, sans-serif`
  const canvas = document.createElement('canvas')
  const measure = canvas.getContext('2d')
  measure.font = font
  measure.letterSpacing = `${size * 4 * -0.025}px`
  const width = Math.ceil(measure.measureText('webassure').width) + size
  canvas.width = width
  canvas.height = size * 6
  const ctx = canvas.getContext('2d')
  ctx.font = font
  ctx.letterSpacing = `${size * 4 * -0.025}px`
  ctx.fillStyle = `#${color}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('webassure', 0, size * 4)
  return { data: canvas.toDataURL('image/png'), w: width / 4, h: size * 1.5 }
}

async function fileData(src) {
  const blob = await (await fetch(src)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// One set of line breaks, measured with the site's font, drives the preview, PDF and PPT.
export function wrapText(item) {
  const ctx = document.createElement('canvas').getContext('2d')
  const family = getComputedStyle(document.documentElement).getPropertyValue(item.font === 'brand' ? '--font-archivo' : '--font-hanken').trim()
  const fontFor = (bold) => `${bold ? 600 : 400} ${item.size}px ${family}, sans-serif`
  ctx.letterSpacing = `${item.size * (item.ls || 0)}px`
  const parts = typeof item.value === 'string' ? [{ t: item.value }] : item.value

  const lines = [[]]
  let width = 0
  for (const part of parts) {
    const bold = Boolean(part.b || item.weight === 600)
    const color = part.c || item.color
    ctx.font = fontFor(bold)
    part.t.split('\n').forEach((chunk, index) => {
      if (index > 0) { lines.push([]); width = 0 }
      for (const word of chunk.split(/(?<=\s)/)) {
        const size = ctx.measureText(word.trimEnd()).width
        if (width + size > item.w && lines[lines.length - 1].length) { lines.push([]); width = 0 }
        const line = lines[lines.length - 1]
        const last = line[line.length - 1]
        if (last && last.bold === bold && last.color === color) last.text += word
        else line.push({ text: word, bold, color })
        width += ctx.measureText(word).width
      }
    })
  }
  return lines
}

// Each line is its own box with no wrapping and no line-spacing value, so a substituted
// font or another editor (PowerPoint, Keynote, Canva) cannot reflow lines into each other.
function addText(slide, item) {
  const height = item.size * item.lh
  wrapText(item).forEach((line, index) => {
    const value = line.map((run, runIndex) => ({
      text: runIndex === line.length - 1 ? run.text.trimEnd() : run.text,
      options: { bold: run.bold, color: run.color },
    }))
    slide.addText(value, {
      x: inch(item.x), y: inch(item.y + index * height), w: inch(item.w), h: inch(height), margin: 0, wrap: false,
      fontFace: item.font === 'brand' ? 'Archivo' : 'Hanken Grotesk',
      fontSize: pt(item.size), align: item.align || 'left', valign: 'middle',
      charSpacing: pt(item.size * (item.ls || 0)),
    })
  })
}

// PptxGenJS 4.0.1 browser build, served as a file because its npm entry needs Node.
function loadPptxLibrary() {
  if (window.PptxGenJS) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/deck/pptxgen.bundle.js'
    script.onload = resolve
    script.onerror = reject
    document.head.append(script)
  })
}

export async function downloadPptx(mode) {
  await document.fonts.ready
  await loadPptxLibrary()
  const theme = THEMES[mode]
  const pptx = new window.PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = 'WebAssure Pitch Deck'
  pptx.author = 'Team Fantastic 4'
  pptx.company = 'WebAssure'

  const images = new Map()
  const image = async (src) => {
    if (!images.has(src)) images.set(src, await fileData(src))
    return images.get(src)
  }

  for (const page of buildSlides(mode)) {
    const slide = pptx.addSlide()
    slide.background = { color: theme.bg }
    const order = (item) => (item.type === 'rect' ? 0 : item.type === 'arrow' ? 1 : 2)
    for (const item of [...page.items].sort((a, b) => order(a) - order(b))) {
      if (item.type === 'text') addText(slide, item)
      if (item.type === 'rect') {
        slide.addShape(item.radius ? 'roundRect' : 'rect', {
          x: inch(item.x), y: inch(item.y), w: inch(item.w), h: inch(item.h),
          rectRadius: inch(item.radius), fill: { color: item.fill },
          line: item.stroke ? { color: item.stroke, width: 0.75 } : { type: 'none' },
        })
      }
      if (item.type === 'arrow') {
        slide.addShape('line', {
          x: inch(Math.min(item.x1, item.x2)), y: inch(Math.min(item.y1, item.y2)),
          w: inch(Math.abs(item.x2 - item.x1)), h: inch(Math.abs(item.y2 - item.y1)),
          flipH: item.x2 < item.x1, flipV: item.y2 < item.y1,
          line: { color: item.color, width: 1, endArrowType: 'triangle' },
        })
      }
      if (item.type === 'image') {
        slide.addImage({ data: await image(item.src), x: inch(item.x), y: inch(item.y), w: inch(item.w), h: inch(item.h), altText: item.alt })
      }
      if (item.type === 'shield') {
        slide.addImage({ data: shieldImage(item.color), x: inch(item.x), y: inch(item.y), w: inch(item.size), h: inch((item.size * 48) / 52), altText: 'WebAssure shield' })
      }
      if (item.type === 'wordmark') {
        const mark = wordmarkImage(item.size, item.color)
        slide.addImage({ data: mark.data, x: inch(item.x), y: inch(item.y - item.size * 0.1), w: inch(mark.w), h: inch(mark.h), altText: 'webassure' })
      }
    }
  }
  await pptx.writeFile({ fileName: `${file(mode)}.pptx` })
}

export async function downloadPdf(nodes, mode) {
  await document.fonts.ready
  const [{ jsPDF }, { getFontEmbedCSS, toPng }] = await Promise.all([import('jspdf'), import('html-to-image')])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H], hotfixes: ['px_scaling'], compress: true })
  pdf.setProperties({ title: 'WebAssure Pitch Deck', author: 'Team Fantastic 4' })
  const fontEmbedCSS = await getFontEmbedCSS(nodes[0])
  for (const [index, node] of nodes.entries()) {
    const data = await toPng(node, {
      pixelRatio: 2560 / node.offsetWidth, cacheBust: false, fontEmbedCSS,
      backgroundColor: `#${THEMES[mode].bg}`, style: { borderRadius: '0', boxShadow: 'none' },
    })
    if (index > 0) pdf.addPage([W, H], 'landscape')
    pdf.addImage(data, 'PNG', 0, 0, W, H, undefined, 'FAST')
  }
  pdf.save(`${file(mode)}.pdf`)
}
