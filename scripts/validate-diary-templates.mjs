// AIGC START
/**
 * 校验 content/diary/templates.json（diaryTemplatesSchema）。
 * 需先存在 electron-dist（npm run build 或 tsc -p tsconfig.electron.json）。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { diaryTemplatesSchema } from '../electron-dist/shared/diary-schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.join(__dirname, '../content/diary/templates.json')

const raw = fs.readFileSync(filePath, 'utf8')
const data = JSON.parse(raw)
diaryTemplatesSchema.parse(data)
const keys = Object.keys(data.moodTags).length
console.log(`validate-diary-templates: OK (mood tag groups: ${keys})`)
// AIGC END
