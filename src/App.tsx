// AIGC START
import { RendererApp } from './renderer/App'
import { DiaryWindow } from './renderer/DiaryWindow'
import { GameWindow } from './renderer/GameWindow'

const params = new URLSearchParams(window.location.search)
const isDiaryWindow = params.has('diary')
const isGameWindow = params.has('game')

export function App() {
  if (isDiaryWindow) return <DiaryWindow />
  if (isGameWindow) return <GameWindow />
  return <RendererApp />
}
// AIGC END
