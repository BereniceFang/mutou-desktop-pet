// AIGC START
import { RendererApp } from './renderer/App'
import { DiaryWindow } from './renderer/DiaryWindow'

const isDiaryWindow = new URLSearchParams(window.location.search).has('diary')

export function App() {
  return isDiaryWindow ? <DiaryWindow /> : <RendererApp />
}
// AIGC END
