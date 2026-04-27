// AIGC START
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

async function main() {
  const raw = JSON.parse(await readFile(path.join(root, 'content/interactive-plots.json'), 'utf8'))

  if (!Array.isArray(raw.plots) || raw.plots.length < 1) {
    throw new Error('interactive-plots: plots 须为非空数组')
  }

  for (const p of raw.plots) {
    if (typeof p.id !== 'string' || !p.id) {
      throw new Error('interactive-plots: plot.id 无效')
    }

    if (typeof p.prompt !== 'string' || !p.prompt) {
      throw new Error(`interactive-plots: ${p.id} prompt 无效`)
    }

    if (!Array.isArray(p.choices) || p.choices.length < 2) {
      throw new Error(`interactive-plots: ${p.id} choices 至少 2 条`)
    }

    for (const c of p.choices) {
      if (typeof c.id !== 'string' || !c.id) {
        throw new Error(`interactive-plots: ${p.id} choice.id 无效`)
      }

      if (typeof c.label !== 'string' || !c.label) {
        throw new Error(`interactive-plots: ${p.id} choice.label 无效`)
      }

      if (typeof c.text !== 'string' || !c.text) {
        throw new Error(`interactive-plots: ${p.id} choice.text 无效`)
      }

      if (typeof c.expressionHint !== 'string' || typeof c.motionHint !== 'string') {
        throw new Error(`interactive-plots: ${p.id} choice 缺少 expressionHint / motionHint`)
      }
    }
  }

  console.log('validate-interactive-plots: OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
// AIGC END
