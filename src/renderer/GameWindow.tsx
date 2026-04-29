// AIGC START
import { useCallback, useRef, useState } from 'react'
import { usePetStore } from './stores/pet-store'
import './game-window.css'

const RPS_CHOICES = ['rock', 'scissors', 'paper'] as const
const RPS_LABELS: Record<string, string> = { rock: '石头', scissors: '剪刀', paper: '布' }
const RPS_EMOJI: Record<string, string> = { rock: '✊', scissors: '✌️', paper: '✋' }

export function GameWindow() {
  const [tab, setTab] = useState<'rps' | 'bomb'>('rps')
  const handleClose = useCallback(() => { window.petApp.closeGameWindow() }, [])

  return (
    <div className="gw-root">
      <div className="gw-header gw-header-drag">
        <span className="gw-title">小游戏</span>
        <button className="gw-close" onClick={handleClose}>✕</button>
      </div>
      <div className="gw-tabs">
        <button className={`gw-tab ${tab === 'rps' ? 'active' : ''}`} onClick={() => setTab('rps')}>猜拳</button>
        <button className={`gw-tab ${tab === 'bomb' ? 'active' : ''}`} onClick={() => setTab('bomb')}>数字炸弹</button>
      </div>
      <div className="gw-body">
        {tab === 'rps' ? <RpsGame /> : <BombGame />}
      </div>
    </div>
  )
}

function RpsGame() {
  const [result, setResult] = useState<{ player: string; pet: string; outcome: string } | null>(null)

  function play(choice: string) {
    const petChoice = RPS_CHOICES[Math.floor(Math.random() * 3)]
    let outcome: string
    if (choice === petChoice) outcome = 'draw'
    else if (
      (choice === 'rock' && petChoice === 'scissors') ||
      (choice === 'scissors' && petChoice === 'paper') ||
      (choice === 'paper' && petChoice === 'rock')
    ) outcome = 'win'
    else outcome = 'lose'

    setResult({ player: choice, pet: petChoice, outcome })

    const bubbles: Record<string, string[]> = {
      win: ['输了输了……再来一局！', '你赢了，我不服。', '哼，下次我一定赢回来。'],
      lose: ['嘿嘿，我赢了。', '木头大胜利！', '你输了，要不要抱抱安慰一下？'],
      draw: ['平手！默契还不错嘛。', '想一块去了，再来。', '我们心有灵犀？'],
    }
    const lines = bubbles[outcome]
    usePetStore.setState({ bubbleText: lines[Math.floor(Math.random() * lines.length)] })
    window.petApp.recordGameResult('猜拳', outcome)
  }

  return (
    <div className="gw-game">
      {result && (
        <div className="rps-result">
          <span className="rps-side">{RPS_EMOJI[result.player]} 你</span>
          <span className="rps-vs">vs</span>
          <span className="rps-side">木头 {RPS_EMOJI[result.pet]}</span>
          <span className={`rps-outcome rps-${result.outcome}`}>
            {result.outcome === 'win' ? '你赢了' : result.outcome === 'lose' ? '木头赢了' : '平手'}
          </span>
        </div>
      )}
      <div className="rps-choices">
        {RPS_CHOICES.map((c) => (
          <button key={c} className="rps-btn" onClick={() => play(c)}>
            <span className="rps-emoji">{RPS_EMOJI[c]}</span>
            <span className="rps-label">{RPS_LABELS[c]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BombGame() {
  const bombRef = useRef(Math.floor(Math.random() * 100) + 1)
  const loRef = useRef(1)
  const hiRef = useRef(100)
  const [lo, setLo] = useState(1)
  const [hi, setHi] = useState(100)
  const [gameOver, setGameOver] = useState<'win' | 'lose' | null>(null)
  const [explodedNum, setExplodedNum] = useState<number | null>(null)
  const [turn, setTurn] = useState<'player' | 'pet'>('player')
  const [history, setHistory] = useState<string[]>([])

  function reset() {
    bombRef.current = Math.floor(Math.random() * 100) + 1
    loRef.current = 1
    hiRef.current = 100
    setLo(1)
    setHi(100)
    setGameOver(null)
    setExplodedNum(null)
    setTurn('player')
    setHistory([])
  }

  function guess(num: number, who: 'player' | 'pet') {
    const bomb = bombRef.current
    if (num === bomb) {
      setExplodedNum(num)
      setGameOver(who === 'player' ? 'lose' : 'win')
      setHistory((h) => [...h, `${who === 'player' ? '你' : '木头'}猜了 ${num}——💥 炸弹！`])
      const outcome = who === 'player' ? 'lose' : 'win'
      const bubbles: Record<string, string[]> = {
        win: ['哈哈你踩雷了！', '炸弹是你的了，我赢了。', '我就知道这个数字有鬼。'],
        lose: ['啊……我踩到了。', '不会吧不会吧，偏偏是我。', '炸弹居然在这里，好气。'],
      }
      const lines = bubbles[outcome]
      usePetStore.setState({ bubbleText: lines[Math.floor(Math.random() * lines.length)] })
      window.petApp.recordGameResult('数字炸弹', outcome)
      return
    }

    if (num < bomb) { loRef.current = num + 1 }
    else { hiRef.current = num - 1 }
    const nextLo = loRef.current
    const nextHi = hiRef.current
    setLo(nextLo)
    setHi(nextHi)
    setHistory((h) => [...h, `${who === 'player' ? '你' : '木头'}猜了 ${num} → 范围 ${nextLo}~${nextHi}`])

    if (who === 'player') {
      setTurn('pet')
      setTimeout(() => {
        const curLo = loRef.current
        const curHi = hiRef.current
        const petGuess = curLo + Math.floor(Math.random() * (curHi - curLo + 1))
        guess(petGuess, 'pet')
      }, 800)
    } else {
      setTurn('player')
    }
  }

  return (
    <div className="gw-game bomb-layout">
      <div className="bomb-range">范围：{lo} ~ {hi}</div>

      <div className="bomb-grid-area">
        <div className="bomb-grid">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
            const inRange = n >= lo && n <= hi
            const isExploded = n === explodedNum
            return (
              <button
                key={n}
                className={`bomb-num ${!inRange ? 'bomb-num-out' : ''} ${isExploded ? 'bomb-num-exploded' : ''}`}
                disabled={!inRange || turn !== 'player' || gameOver !== null}
                onClick={() => guess(n, 'player')}
              >{isExploded ? '💥' : n}</button>
            )
          })}
        </div>
        {gameOver && (
          <div className="bomb-grid-overlay">
            <span className={`bomb-result bomb-${gameOver}`}>
              {gameOver === 'win' ? '你赢了！' : '你踩到炸弹了！'}
            </span>
            <button className="bomb-restart" onClick={reset}>再来一局</button>
          </div>
        )}
      </div>

      <div className="bomb-footer">
        {!gameOver && turn === 'pet' ? (
          <div className="bomb-waiting">木头在想……</div>
        ) : (
          <div className="bomb-hint">选一个数字</div>
        )}
        <div className="bomb-history">
          {history.map((h, i) => <div key={i} className="bomb-line">{h}</div>)}
        </div>
      </div>
    </div>
  )
}
// AIGC END
