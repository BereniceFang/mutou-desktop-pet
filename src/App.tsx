// AIGC START
import { RendererApp } from './renderer/App'
import { DiaryWindow } from './renderer/DiaryWindow'
import { GameWindow } from './renderer/GameWindow'
import { MemoWindow } from './renderer/MemoWindow'

const params = new URLSearchParams(window.location.search)
const isDiaryWindow = params.has('diary')
const isGameWindow = params.has('game')
const isMemoWindow = params.has('memo')

export function App() {
  if (isDiaryWindow) return <DiaryWindow />
  if (isGameWindow) return <GameWindow />
  if (isMemoWindow) return <MemoWindow />
  return <RendererApp />
}
// AIGC END
