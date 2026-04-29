// AIGC START
import { useCallback, useEffect, useRef, useState } from 'react'

import mutouIdle from '../assets/mutou_base_idle_v1.png'
import mutouTalk from '../assets/mutou_talk_idle_v1.gif'
import {
  FOOD_CATALOG,
  getFeedSatietyGainForPreference,
  isFoodUnlockedForTier,
} from '../shared/food-catalog.js'
import { ALL_DIALOGUE_TYPES } from '../shared/content-schema.js'

const IS_DEV = Boolean(import.meta.env.DEV)
import { usePetStore } from './stores/pet-store.js'
import type { FoodCategoryFilter, PanelId } from './stores/ui-store.js'
import { useUiStore } from './stores/ui-store.js'
import './styles.css'

const IDLE_BUBBLE_INTERVALS: Record<string, [number, number]> = {
  high:   [15_000, 25_000],
  medium: [30_000, 50_000],
  low:    [60_000, 90_000],
}
const FOCUS_HEARTBEAT_INTERVAL_MS = 60_000
const BUBBLE_AUTO_DISMISS_MS = 8_000
const FAREWELL_DISPLAY_MS = 4_000

function randomInRange([min, max]: [number, number]) {
  return min + Math.random() * (max - min)
}

function parseColorAlpha(css: string): { hex: string; alpha: number } {
  const rgbaMatch = css.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/)
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1])
    const g = Number(rgbaMatch[2])
    const b = Number(rgbaMatch[3])
    const a = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1
    const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
    return { hex, alpha: Math.round(a * 100) / 100 }
  }
  if (/^#[0-9a-f]{6}$/i.test(css)) return { hex: css, alpha: 1 }
  if (/^#[0-9a-f]{3}$/i.test(css)) {
    const full = `#${css[1]}${css[1]}${css[2]}${css[2]}${css[3]}${css[3]}`
    return { hex: full, alpha: 1 }
  }
  return { hex: '#000000', alpha: 1 }
}

function buildRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if (alpha >= 1) return hex
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function RendererApp() {
  const {
    ready, appState, bubbleText, actions, branchChoices,
    bootstrap, triggerStartupGreeting, handleClick,
    handleFeed, requestComfort, resolveBranchChoice, triggerIdleBubble,
    startFocus, focusHeartbeat, completeFocus, interruptFocus,
    updateSettings,
  } = usePetStore()

  const { activePanel, actionBarVisible, feedCategory, togglePanel, setPanel, setFeedCategory, toggleActionBar } = useUiStore()

  const [quitting, setQuitting] = useState(false)
  const [unlockToast, setUnlockToast] = useState<string | null>(null)
  const [reminderBubble, setReminderBubble] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    const checkRewards = async () => {
      const tierUp = await window.petApp.checkTierUp() as string | null
      if (tierUp) {
        if (!usePetStore.getState().reminderLock) usePetStore.setState({ bubbleText: tierUp })
        setUnlockToast('关系升级了!')
        setTimeout(() => setUnlockToast(null), 5000)
        return
      }
      const news = await window.petApp.checkNewUnlocks() as string[]
      if (news.length > 0) {
        setUnlockToast(news[0])
        setTimeout(() => setUnlockToast(null), 5000)
      }
    }
    const id = setInterval(checkRewards, 10_000)
    const memoId = setInterval(async () => {
      const reminder = await window.petApp.checkMemoReminders() as string | null
      if (reminder) {
        usePetStore.setState({ bubbleText: reminder, reminderLock: true })
        setReminderBubble(reminder)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('木头提醒你', { body: reminder })
        } else if ('Notification' in window && Notification.permission !== 'denied') {
          Notification.requestPermission().then((p) => {
            if (p === 'granted') new Notification('木头提醒你', { body: reminder })
          })
        }
      }
    }, 30_000)
    return () => { clearInterval(id); clearInterval(memoId) }
  }, [ready])

  const waterLines = [
    '该喝水了，别让我一个人润着。',
    '你多久没喝水了？我帮你记着呢。',
    '喝口水吧，坐了好一阵了。',
    '补水时间到，嘴巴干了我会心疼的。',
    '水杯还在旁边吗？拿起来喝一口。',
    '我替你倒不了水，但我能提醒你。',
    '今天的水喝够了吗？来，喝一口。',
    '休息一下，先喝口水再继续。',
    '你上次喝水是什么时候？我猜你忘了。',
    '我的提醒很轻，但水要真的喝进去才行。',
  ]
  const waterIntervalMs = (appState?.settings.waterReminderIntervalMin ?? 45) * 60_000
  const waterEnabled = appState?.settings.waterReminderEnabled ?? false
  useEffect(() => {
    if (!ready || !waterEnabled) return
    const id = setInterval(() => {
      const line = waterLines[Math.floor(Math.random() * waterLines.length)]
      usePetStore.setState({ bubbleText: line, reminderLock: true })
      setReminderBubble(line)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('木头提醒你', { body: line })
      }
    }, waterIntervalMs)
    return () => clearInterval(id)
  }, [ready, waterEnabled, waterIntervalMs])
  const handleQuit = useCallback(async () => {
    if (quitting) return
    setQuitting(true)
    const line = await window.petApp.getRandomFarewellLine() as string
    usePetStore.setState({ bubbleText: line })
    setTimeout(() => { window.petApp.quitApp() }, FAREWELL_DISPLAY_MS)
  }, [quitting])

  const [showMoodCheckin, setShowMoodCheckin] = useState(false)

  useEffect(() => {
    bootstrap().then(() => {
      triggerStartupGreeting()
      const lastCheckin = localStorage.getItem('mutou_mood_checkin_date')
      const today = new Date().toISOString().slice(0, 10)
      if (lastCheckin !== today) {
        setTimeout(() => setShowMoodCheckin(true), 3000)
      }
    })
  }, [bootstrap, triggerStartupGreeting])

  const handleMoodCheckin = useCallback((mood: string) => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('mutou_mood_checkin_date', today)
    localStorage.setItem('mutou_mood_checkin_value', mood)
    setShowMoodCheckin(false)
    const responses: Record<string, string> = {
      great: '今天状态不错嘛，我也跟着开心起来了。',
      ok: '平平稳稳的也很好，我陪你慢慢过。',
      tired: '累了就靠我一会儿，不用硬撑。',
      sad: '不开心的话，我今天会多陪你一点。',
    }
    usePetStore.setState({ bubbleText: responses[mood] ?? responses.ok })
    window.petApp.recordMoodCheckin(mood)
  }, [])

  const disturbanceLevel = appState?.settings.disturbanceLevel ?? 'medium'
  useEffect(() => {
    if (!ready || appState?.focusSession.status === 'in_progress') return
    const range = IDLE_BUBBLE_INTERVALS[disturbanceLevel] ?? IDLE_BUBBLE_INTERVALS.medium
    let timer: ReturnType<typeof setTimeout>
    function scheduleNext() {
      timer = setTimeout(() => {
        triggerIdleBubble()
        scheduleNext()
      }, randomInRange(range))
    }
    scheduleNext()
    return () => clearTimeout(timer)
  }, [ready, triggerIdleBubble, appState?.focusSession.status, disturbanceLevel])

  useEffect(() => {
    if (appState?.focusSession.status !== 'in_progress') return
    const id = setInterval(focusHeartbeat, FOCUS_HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [focusHeartbeat, appState?.focusSession.status])

  const { clearBubble } = usePetStore()
  useEffect(() => {
    if (!bubbleText || quitting || reminderBubble) return
    const id = setTimeout(clearBubble, BUBBLE_AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [bubbleText, clearBubble, quitting, reminderBubble])

  const dragRef = useRef(false)
  const lastDragBubbleRef = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    dragRef.current = false
    window.petApp.startWindowDrag(e.screenX, e.screenY)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons !== 1) return
    if (!dragRef.current) {
      dragRef.current = true
      const now = Date.now()
      if (now - lastDragBubbleRef.current > 15_000) {
        lastDragBubbleRef.current = now
        window.petApp.triggerDragBubble().then((r) => {
          const res = r as { state: unknown; bubbleText: string | null }
          if (res.bubbleText && !usePetStore.getState().reminderLock) usePetStore.setState({ bubbleText: res.bubbleText })
        })
      }
    }
    window.petApp.dragWindowTo(e.screenX, e.screenY)
  }, [])

  const onPointerUp = useCallback(() => {
    window.petApp.endWindowDrag()
  }, [])

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onSpriteClick = useCallback(() => {
    if (dragRef.current) return
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      handleClick()
    }, 250)
  }, [handleClick])

  const onSpriteDoubleClick = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    requestComfort('light')
  }, [requestComfort])

  const onSpriteContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    toggleActionBar()
  }, [toggleActionBar])

  const onInteractiveEnter = useCallback(() => { window.petApp.notifyMouseEnter() }, [])
  const onInteractiveLeave = useCallback(() => { window.petApp.notifyMouseLeave() }, [])

  if (!ready || !appState) {
    return <div className="pet-loading">Loading...</div>
  }

  const isTalking = bubbleText !== null
  const isFocusing = appState.focusSession.status === 'in_progress'
  const tier = appState.relationshipTier as 'low' | 'mid' | 'high'

  return (
    <div
      className="pet-root"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Unlock toast */}
      {unlockToast && <div className="unlock-toast">{unlockToast}</div>}

      {/* Daily mood check-in */}
      {showMoodCheckin && (
        <div className="mood-checkin" data-no-drag onMouseEnter={onInteractiveEnter} onMouseLeave={onInteractiveLeave}>
          <div className="mood-checkin-title">今天感觉怎么样？</div>
          <div className="mood-checkin-options">
            <button onClick={() => handleMoodCheckin('great')}>很好</button>
            <button onClick={() => handleMoodCheckin('ok')}>还行</button>
            <button onClick={() => handleMoodCheckin('tired')}>有点累</button>
            <button onClick={() => handleMoodCheckin('sad')}>不太好</button>
          </div>
        </div>
      )}

      {/* Bubble floats above sprite */}
      {bubbleText && (
        <div className="bubble-wrapper">
          <div
            className={`bubble ${reminderBubble ? 'bubble-reminder' : ''}`}
            style={{
              backgroundColor: appState.settings.bubbleStyle.backgroundColor,
              borderColor: reminderBubble ? 'rgba(255,180,100,0.5)' : appState.settings.bubbleStyle.borderColor,
              borderWidth: appState.settings.bubbleStyle.borderWidth || 1,
              color: appState.settings.bubbleStyle.textColor,
            }}
          >
            <p className="bubble-text">{bubbleText}</p>
            {reminderBubble && (
              <button
                className="bubble-dismiss"
                onClick={() => { setReminderBubble(null); usePetStore.setState({ reminderLock: false, bubbleText: null }) }}
                onMouseEnter={onInteractiveEnter}
                onMouseLeave={onInteractiveLeave}
              >
                知道了
              </button>
            )}
          </div>
        </div>
      )}

      {/* Branch choices */}
      {branchChoices && branchChoices.length > 0 && (
        <div className="branch-wrapper" data-no-drag onMouseEnter={onInteractiveEnter} onMouseLeave={onInteractiveLeave}>
          {branchChoices.map((c) => (
            <button
              key={c.id}
              className="branch-btn"
              onClick={() => resolveBranchChoice(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Pet sprite — only this area is draggable */}
      <div
        className="sprite-container"
        onPointerDown={onPointerDown}
        onClick={onSpriteClick}
        onDoubleClick={onSpriteDoubleClick}
        onContextMenu={onSpriteContextMenu}
        onMouseEnter={onInteractiveEnter}
        onMouseLeave={onInteractiveLeave}
      >
        <img
          className="sprite"
          src={isTalking ? mutouTalk : mutouIdle}
          alt="Mutou"
          draggable={false}
        />
      </div>

      {/* Action bar — right-click sprite to toggle */}
      {actionBarVisible && (
        <div className="action-bar" data-no-drag onMouseEnter={onInteractiveEnter} onMouseLeave={onInteractiveLeave}>
          {actions.filter((a) => a.id !== 'comfort').map((a) => (
            <button
              key={a.id}
              className={`action-btn ${activePanel === a.id ? 'active' : ''}`}
              onClick={() => togglePanel(a.id as Exclude<PanelId, null>)}
            >
              {a.label}
            </button>
          ))}
          <button className="action-btn action-btn-comfort" onClick={() => requestComfort('light')}>
            轻声陪伴
          </button>
          <button className="action-btn action-btn-comfort" onClick={() => requestComfort('heavy')}>
            认真安慰
          </button>
          <button
            className="action-btn"
            onClick={() => window.petApp.openMemoWindow()}
          >
            便签
          </button>
          <button
            className="action-btn"
            onClick={() => window.petApp.openGameWindow()}
          >
            小游戏
          </button>
          <button
            className="action-btn"
            onClick={() => window.petApp.openDiaryWindow()}
          >
            日记
          </button>
          {IS_DEV && (
            <button
              className={`action-btn action-btn-debug ${activePanel === 'debug' ? 'active' : ''}`}
              onClick={() => togglePanel('debug')}
            >
              调试
            </button>
          )}
          <button
            className="action-btn action-btn-quit"
            onClick={handleQuit}
            disabled={quitting}
          >
            {quitting ? '再见…' : '退出'}
          </button>
        </div>
      )}

      {/* Panels */}
      {actionBarVisible && activePanel && (
        <div className="panel-layer" data-no-drag onMouseEnter={onInteractiveEnter} onMouseLeave={onInteractiveLeave}>
          <div className="panel-header">
            <span className="panel-title">
              {actions.find((a) => a.id === activePanel)?.label ?? ({ diary: '日记', game: '小游戏', debug: '调试' } as Record<string, string>)[activePanel ?? ''] ?? activePanel}
            </span>
            <button className="panel-close" onClick={() => setPanel(null)}>✕</button>
          </div>

          {activePanel === 'status' && <StatusPanel appState={appState} />}
          {activePanel === 'feed' && (
            <FeedPanel
              tier={tier}
              satiety={appState.stats.satiety}
              feedCategory={feedCategory}
              setFeedCategory={setFeedCategory}
              onFeed={handleFeed}
            />
          )}
          {activePanel === 'focus' && (
            <FocusPanel
              isFocusing={isFocusing}
              session={appState.focusSession}
              stats={appState.stats}
              onStart={startFocus}
              onComplete={completeFocus}
              onInterrupt={interruptFocus}
            />
          )}
          {activePanel === 'settings' && (
            <SettingsPanel settings={appState.settings} onUpdate={updateSettings} />
          )}
          {activePanel === 'collection' && <CollectionPanel />}
          {activePanel === 'diary' && <DiaryPanel />}
          {activePanel === 'debug' && <DebugPanel />}
        </div>
      )}
    </div>
  )
}

const TIER_LABELS: Record<string, string> = { low: '初识', mid: '熟悉', high: '亲密' }
const TIER_THRESHOLDS: Record<string, number> = { low: 60, mid: 200, high: Infinity }

function StatusPanel({ appState }: { appState: NonNullable<ReturnType<typeof usePetStore.getState>['appState']> }) {
  const s = appState.stats
  const tier = appState.relationshipTier
  const tierLabel = TIER_LABELS[tier] ?? tier
  const nextThreshold = TIER_THRESHOLDS[tier] ?? Infinity
  const progress = nextThreshold === Infinity ? 1 : Math.min(1, s.favorability / nextThreshold)
  const nick = appState.settings.userNickname || '主人'

  return (
    <div className="panel-body profile-panel">
      {/* Identity */}
      <div className="profile-header">
        <div className="profile-name">木头</div>
        <div className="profile-relation">{tierLabel}（{nick}）· 第 {s.companionDays} 天</div>
      </div>

      {/* Relationship bar */}
      <div className="profile-section">
        <div className="profile-bar-label">
          <span>好感 {s.favorability}</span>
          {nextThreshold !== Infinity && <span className="profile-bar-next">→ {TIER_LABELS[tier === 'low' ? 'mid' : 'high']}（{nextThreshold}）</span>}
        </div>
        <div className="profile-bar">
          <div className="profile-bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* Vitals */}
      <div className="profile-section">
        <div className="profile-section-title">状态</div>
        <div className="profile-vitals">
          <div className="profile-vital">
            <span className="vital-label">心情</span>
            <div className="vital-bar"><div className="vital-fill vital-mood" style={{ width: `${s.mood}%` }} /></div>
            <span className="vital-num">{s.mood}</span>
          </div>
          <div className="profile-vital">
            <span className="vital-label">精力</span>
            <div className="vital-bar"><div className="vital-fill vital-energy" style={{ width: `${s.energy}%` }} /></div>
            <span className="vital-num">{s.energy}</span>
          </div>
          <div className="profile-vital">
            <span className="vital-label">饱腹</span>
            <div className="vital-bar"><div className="vital-fill vital-satiety" style={{ width: `${s.satiety}%` }} /></div>
            <span className="vital-num">{Math.round(s.satiety)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="profile-section">
        <div className="profile-section-title">档案</div>
        <div className="profile-stats">
          <div className="profile-stat"><span className="stat-num">{Number(s.visitStreak ?? 0)}</span><span className="stat-label">连续签到</span></div>
          <div className="profile-stat"><span className="stat-num">{s.interactionCount}</span><span className="stat-label">互动</span></div>
          <div className="profile-stat"><span className="stat-num">{s.feedCount}</span><span className="stat-label">喂食</span></div>
          <div className="profile-stat"><span className="stat-num">{s.focusCompletedCount}</span><span className="stat-label">专注</span></div>
          <div className="profile-stat"><span className="stat-num">{s.tacit}</span><span className="stat-label">默契</span></div>
          <div className="profile-stat"><span className="stat-num">{Number(s.focusTotalMinutes ?? 0)}</span><span className="stat-label">专注分钟</span></div>
          <div className="profile-stat"><span className="stat-num">{s.nightInteractionCount}</span><span className="stat-label">深夜互动</span></div>
        </div>
      </div>

      {/* Milestones timeline */}
      <MilestonesTimeline />
    </div>
  )
}

function MilestonesTimeline() {
  const [milestones, setMilestones] = useState<{ key: string; label: string; date: string }[]>([])

  useEffect(() => {
    window.petApp.getMilestones().then((m) => setMilestones(m as { key: string; label: string; date: string }[]))
  }, [])

  if (milestones.length === 0) return null

  return (
    <div className="profile-section">
      <div className="profile-section-title">成长里程碑</div>
      <div className="milestone-list">
        {milestones.map((m) => (
          <div key={m.key} className="milestone-item">
            <div className="milestone-dot" />
            <div className="milestone-content">
              <span className="milestone-label">{m.label}</span>
              <span className="milestone-date">{m.date.slice(0, 10)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeedPanel({
  tier, satiety, feedCategory, setFeedCategory, onFeed,
}: {
  tier: 'low' | 'mid' | 'high'
  satiety: number
  feedCategory: FoodCategoryFilter
  setFeedCategory: (c: FoodCategoryFilter) => void
  onFeed: (foodType: string) => Promise<void>
}) {
  const categories: FoodCategoryFilter[] = ['all', 'sweet', 'fruit', 'drink', 'savory', 'meal']
  const catLabels: Record<FoodCategoryFilter, string> = {
    all: '全部', sweet: '甜食', fruit: '水果', drink: '饮品', savory: '咸食', meal: '正餐',
  }

  const foods = FOOD_CATALOG.filter((f) => feedCategory === 'all' || f.category === feedCategory)

  return (
    <div className="panel-body feed-panel">
      <div className="feed-satiety">饱腹度: {Math.round(satiety)} / 100</div>
      <div className="feed-categories">
        {categories.map((c) => (
          <button
            key={c}
            className={`cat-btn ${feedCategory === c ? 'active' : ''}`}
            onClick={() => setFeedCategory(c)}
          >{catLabels[c]}</button>
        ))}
      </div>
      <div className="feed-grid">
        {foods.map((food) => {
          const unlocked = isFoodUnlockedForTier(food, tier)
          const gain = getFeedSatietyGainForPreference(food.preferenceScore, food.category)
          return (
            <button
              key={food.id}
              className={`food-item ${unlocked ? '' : 'locked'} ${food.seasonalUnlock ? 'seasonal' : ''}`}
              disabled={!unlocked || satiety >= 100}
              onClick={() => onFeed(food.id)}
              title={unlocked ? `${food.label} (+${gain} 饱腹)` : food.seasonalUnlock ? '限定时令食物' : '需要更高关系等级'}
            >
              <span className="food-label">{food.label}</span>
              {food.seasonalUnlock && unlocked && <span className="food-seasonal">限定</span>}
              {unlocked && <span className="food-gain">+{gain}</span>}
              {!unlocked && <span className="food-lock">{food.seasonalUnlock ? '⏳' : '🔒'}</span>}
            </button>
          )
        })}
      </div>
      <div className="feed-card-footer">
        <span className="feed-card-satiety-delta">
          {satiety >= 100 ? '已经饱了' : `当前饱腹 ${Math.round(satiety)}`}
        </span>
      </div>
    </div>
  )
}

const FOCUS_PRESETS = [15, 25, 45, 60, 90]

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function FocusPanel({
  isFocusing, session, stats, onStart, onComplete, onInterrupt,
}: {
  isFocusing: boolean
  session: NonNullable<ReturnType<typeof usePetStore.getState>['appState']>['focusSession']
  stats: NonNullable<ReturnType<typeof usePetStore.getState>['appState']>['stats']
  onStart: (duration: number, goal?: string) => Promise<void>
  onComplete: (reviewTone: 'done' | 'partial' | 'enough') => Promise<void>
  onInterrupt: () => Promise<void>
}) {
  const [customDur, setCustomDur] = useState(25)
  const [goal, setGoal] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!isFocusing) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isFocusing])

  if (isFocusing) {
    const startMs = session.startAt ? new Date(session.startAt).getTime() : now
    const elapsedSec = Math.max(0, Math.floor((now - startMs) / 1000))
    const plannedSec = (session.plannedDurationMinutes ?? 25) * 60
    const remainSec = Math.max(0, plannedSec - elapsedSec)
    const progress = Math.min(1, elapsedSec / plannedSec)
    const overTime = elapsedSec > plannedSec

    const circumference = 2 * Math.PI * 54
    const dashOffset = circumference * (1 - progress)

    return (
      <div className="panel-body focus-panel">
        <div className="focus-ring-container">
          <svg className="focus-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={overTime ? 'rgba(255,160,120,0.7)' : 'rgba(134,59,255,0.7)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="focus-ring-text">
            <span className="focus-timer">{overTime ? '+' : ''}{formatTimer(overTime ? elapsedSec - plannedSec : remainSec)}</span>
            <span className="focus-timer-label">{overTime ? '已超时' : '剩余'}</span>
          </div>
        </div>

        {session.goal && <div className="focus-goal">{session.goal}</div>}

        <div className="focus-elapsed">
          已专注 {Math.floor(elapsedSec / 60)} 分钟 / 计划 {session.plannedDurationMinutes} 分钟
        </div>

        <div className="focus-complete-section">
          <span className="focus-complete-hint">完成时的感受：</span>
          <div className="focus-actions">
            <button className="focus-done" onClick={() => onComplete('done')}>搞定了</button>
            <button className="focus-partial" onClick={() => onComplete('partial')}>做了一部分</button>
            <button className="focus-enough" onClick={() => onComplete('enough')}>先到这里</button>
          </div>
        </div>
        <button className="focus-interrupt-btn" onClick={onInterrupt}>中断专注</button>
      </div>
    )
  }

  return (
    <div className="panel-body focus-panel">
      {/* History summary */}
      <div className="focus-history">
        <div className="focus-history-item">
          <span className="focus-history-num">{stats.focusCompletedCount}</span>
          <span className="focus-history-label">完成</span>
        </div>
        <div className="focus-history-item">
          <span className="focus-history-num">{Number(stats.focusTotalMinutes ?? 0)}</span>
          <span className="focus-history-label">总分钟</span>
        </div>
        <div className="focus-history-item">
          <span className="focus-history-num">{Number(stats.focusInterruptedCount ?? 0)}</span>
          <span className="focus-history-label">中断</span>
        </div>
      </div>

      {stats.lastFocusGoal && (
        <div className="focus-last">
          上次：{String(stats.lastFocusGoal)}
          {stats.lastFocusDurationMinutes ? ` (${stats.lastFocusDurationMinutes}分钟)` : ''}
        </div>
      )}

      {/* Duration presets */}
      <div className="focus-presets">
        {FOCUS_PRESETS.map((m) => (
          <button
            key={m}
            className={`focus-preset-btn ${customDur === m ? 'active' : ''}`}
            onClick={() => setCustomDur(m)}
          >
            {m} 分钟
          </button>
        ))}
      </div>

      <label className="focus-field">
        <span>自定义</span>
        <input
          type="number"
          value={customDur}
          min={1} max={240}
          onChange={(e) => setCustomDur(Number(e.target.value) || 25)}
        />
        <span>分钟</span>
      </label>

      <label className="focus-field">
        <span>目标</span>
        <input
          type="text"
          value={goal}
          placeholder="今天要做什么..."
          maxLength={40}
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>

      <button
        className="focus-start-btn"
        onClick={() => {
          onStart(customDur, goal || undefined)
          setGoal('')
        }}
      >
        开始专注 · {customDur} 分钟
      </button>
    </div>
  )
}

function SettingsPanel({
  settings, onUpdate,
}: {
  settings: NonNullable<ReturnType<typeof usePetStore.getState>['appState']>['settings']
  onUpdate: (input: Record<string, unknown>) => Promise<void>
}) {
  return (
    <div className="panel-body settings-panel">
      <label className="setting-row">
        <span>始终在最前</span>
        <input
          type="checkbox"
          checked={settings.alwaysOnTop}
          onChange={(e) => onUpdate({ alwaysOnTop: e.target.checked })}
        />
      </label>
      <label className="setting-row">
        <span>透明度</span>
        <input
          type="range"
          min={0.4}
          max={1}
          step={0.05}
          value={settings.opacity}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
        />
        <span>{Math.round(settings.opacity * 100)}%</span>
      </label>
      <label className="setting-row">
        <span>语音气泡</span>
        <input
          type="checkbox"
          checked={settings.speechEnabled}
          onChange={(e) => onUpdate({ speechEnabled: e.target.checked })}
        />
      </label>
      <label className="setting-row">
        <span>深夜安抚</span>
        <input
          type="checkbox"
          checked={settings.nightComfortEnabled}
          onChange={(e) => onUpdate({ nightComfortEnabled: e.target.checked })}
        />
      </label>
      <label className="setting-row">
        <span>随机冒泡频率</span>
        <select
          className="setting-select"
          value={settings.disturbanceLevel}
          onChange={(e) => onUpdate({ disturbanceLevel: e.target.value })}
        >
          <option value="high">高（15~25 秒）</option>
          <option value="medium">中（30~50 秒）</option>
          <option value="low">低（60~90 秒）</option>
        </select>
      </label>
      <label className="setting-row">
        <span>昵称</span>
        <input
          type="text"
          value={settings.userNickname}
          maxLength={16}
          placeholder="怎么称呼你"
          onChange={(e) => onUpdate({ userNickname: e.target.value })}
        />
      </label>

      <div className="setting-section-title">喝水提醒</div>
      <label className="setting-row">
        <span>开启提醒</span>
        <input
          type="checkbox"
          checked={settings.waterReminderEnabled ?? false}
          onChange={(e) => onUpdate({ waterReminderEnabled: e.target.checked })}
        />
      </label>
      {settings.waterReminderEnabled && (
        <label className="setting-row">
          <span>间隔</span>
          <select
            className="setting-select"
            value={settings.waterReminderIntervalMin ?? 45}
            onChange={(e) => onUpdate({ waterReminderIntervalMin: Number(e.target.value) })}
          >
            <option value={15}>15 分钟</option>
            <option value={30}>30 分钟</option>
            <option value={45}>45 分钟</option>
            <option value={60}>1 小时</option>
            <option value={90}>1.5 小时</option>
            <option value={120}>2 小时</option>
          </select>
        </label>
      )}

      <div className="setting-section-title">我的纪念日（最多 8 个）</div>
      <PersonalDatesEditor
        dates={settings.personalDates}
        onChange={(dates) => onUpdate({ personalDates: dates })}
      />

      <div className="setting-section-title">气泡样式</div>
      <BubbleColorRow
        label="背景颜色"
        value={settings.bubbleStyle.backgroundColor}
        onChange={(v) => onUpdate({ bubbleStyle: { ...settings.bubbleStyle, backgroundColor: v } })}
      />
      <BubbleColorRow
        label="边框颜色"
        value={settings.bubbleStyle.borderColor}
        onChange={(v) => onUpdate({ bubbleStyle: { ...settings.bubbleStyle, borderColor: v } })}
      />
      <label className="setting-row">
        <span>边框粗细</span>
        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={settings.bubbleStyle.borderWidth}
          onChange={(e) => onUpdate({ bubbleStyle: { ...settings.bubbleStyle, borderWidth: Number(e.target.value) } })}
        />
        <span>{settings.bubbleStyle.borderWidth}px</span>
      </label>
      <BubbleColorRow
        label="文字颜色"
        value={settings.bubbleStyle.textColor}
        onChange={(v) => onUpdate({ bubbleStyle: { ...settings.bubbleStyle, textColor: v } })}
      />
    </div>
  )
}

interface PersonalDate {
  id: string; label: string; month: number; day: number; kind: string
}

function PersonalDatesEditor({ dates, onChange }: {
  dates: PersonalDate[]
  onChange: (dates: PersonalDate[]) => void
}) {
  const kindLabels: Record<string, string> = { birthday: '生日', anniversary: '纪念日', other: '其他' }

  function addDate() {
    if (dates.length >= 8) return
    onChange([...dates, { id: `pd_${Date.now()}`, label: '', month: 1, day: 1, kind: 'birthday' }])
  }

  function removeDate(id: string) {
    onChange(dates.filter((d) => d.id !== id))
  }

  function updateDate(id: string, patch: Partial<PersonalDate>) {
    onChange(dates.map((d) => d.id === id ? { ...d, ...patch } : d))
  }

  return (
    <div className="personal-dates-editor">
      {dates.map((d) => (
        <div key={d.id} className="pd-item">
          <input
            className="pd-label"
            type="text"
            placeholder="名称"
            maxLength={32}
            value={d.label}
            onChange={(e) => updateDate(d.id, { label: e.target.value })}
          />
          <select
            className="pd-kind"
            value={d.kind}
            onChange={(e) => updateDate(d.id, { kind: e.target.value })}
          >
            {Object.entries(kindLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            className="pd-num"
            type="number"
            min={1} max={12}
            value={d.month}
            onChange={(e) => updateDate(d.id, { month: Number(e.target.value) })}
          />
          <span className="pd-sep">月</span>
          <input
            className="pd-num"
            type="number"
            min={1} max={31}
            value={d.day}
            onChange={(e) => updateDate(d.id, { day: Number(e.target.value) })}
          />
          <span className="pd-sep">日</span>
          <button className="pd-remove" onClick={() => removeDate(d.id)}>✕</button>
        </div>
      ))}
      {dates.length < 8 && (
        <button className="pd-add" onClick={addDate}>+ 添加纪念日</button>
      )}
    </div>
  )
}

function BubbleColorRow({ label, value, onChange }: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const { hex, alpha } = parseColorAlpha(value)
  return (
    <div className="setting-color-group">
      <label className="setting-row">
        <span>{label}</span>
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(buildRgba(e.target.value, alpha))}
        />
      </label>
      <label className="setting-row setting-row-indent">
        <span>透明度</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={alpha}
          onChange={(e) => onChange(buildRgba(hex, Number(e.target.value)))}
        />
        <span>{Math.round(alpha * 100)}%</span>
      </label>
    </div>
  )
}

function CollectionPanel() {
  const [data, setData] = useState<{ badges: CollectionItem[]; cards: CollectionItem[] } | null>(null)

  useEffect(() => {
    window.petApp.getCollection().then((d) => setData(d as { badges: CollectionItem[]; cards: CollectionItem[] }))
  }, [])

  if (!data) return <div className="panel-body">加载中...</div>

  return (
    <div className="panel-body collection-panel">
      <h4>徽章</h4>
      <div className="collection-grid">
        {data.badges.map((b) => (
          <div key={b.id} className={`collection-item ${b.unlocked ? 'unlocked' : 'locked'}`}>
            <span className="collection-name">{b.unlocked ? b.name : '???'}</span>
            <span className="collection-desc">{b.unlocked ? b.description : b.unlockHint}</span>
          </div>
        ))}
      </div>
      <h4>故事卡</h4>
      <div className="collection-grid">
        {data.cards.map((c) => (
          <div key={c.id} className={`collection-item ${c.unlocked ? 'unlocked' : 'locked'}`}>
            <span className="collection-name">{c.unlocked ? (c as CardItem).title : '???'}</span>
            <span className="collection-desc">{c.unlocked ? (c as CardItem).body : c.unlockHint}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
function friendlyDate(dateKey: string): { month: string; day: string; weekday: string; full: string } {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return {
    month: `${m}月`,
    day: String(d),
    weekday: `周${WEEKDAYS[dt.getDay()]}`,
    full: `${y}年${m}月${d}日`,
  }
}

function DiaryPanel() {
  const [entries, setEntries] = useState<DiaryEntryView[]>([])
  const [selected, setSelected] = useState<DiaryEntryView | null>(null)

  useEffect(() => {
    window.petApp.listDiaryEntries(30).then((d) => setEntries(d as DiaryEntryView[]))
  }, [])

  if (selected) {
    const fd = friendlyDate(selected.dateKey)
    return (
      <div className="panel-body diary-detail">
        <button className="diary-back" onClick={() => setSelected(null)}>← 返回列表</button>
        <div className="diary-detail-header">
          <span className="diary-detail-date">{fd.full} {fd.weekday}</span>
          <span className="diary-detail-mood">— {selected.moodTag}</span>
        </div>
        <h4 className="diary-detail-title">{selected.title}</h4>
        <div className="diary-detail-body">
          {selected.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {selected.highlights.length > 0 && (
          <div className="diary-detail-highlights">
            {selected.highlights.map((h, i) => <span key={i} className="highlight-tag">{h}</span>)}
          </div>
        )}
        {!selected.finalized && (
          <div className="diary-detail-draft">这一页还在书写中……</div>
        )}
      </div>
    )
  }

  return (
    <div className="panel-body diary-list">
      {entries.length === 0 && <p className="diary-empty">还没有日记，明天来翻翻看吧。</p>}
      {entries.map((e) => {
        const fd = friendlyDate(e.dateKey)
        return (
          <div key={e.dateKey} className="diary-item" onClick={() => setSelected(e)}>
            <div className="diary-item-date">
              <span className="diary-item-day">{fd.day}</span>
              <span className="diary-item-month">{fd.month}</span>
            </div>
            <div className="diary-item-content">
              <span className="diary-item-title">{e.title}</span>
              <span className="diary-item-preview">{e.paragraphs[0]?.slice(0, 36) ?? ''}…</span>
            </div>
            <span className="diary-item-mood">{e.moodTag}</span>
          </div>
        )
      })}
    </div>
  )
}

interface CollectionItem { id: string; name: string; description: string; unlockHint: string; unlocked: boolean }
interface CardItem extends CollectionItem { title: string; body: string }
interface DiaryEntryView { dateKey: string; title: string; moodTag: string; paragraphs: string[]; highlights: string[]; finalized: boolean }



const DIALOGUE_TYPE_GROUPS: { label: string; prefix: string }[] = [
  { label: '互动', prefix: 'interaction' },
  { label: '待机', prefix: 'idle' },
  { label: '喂食', prefix: 'feed_' },
  { label: '专注', prefix: 'focus_' },
  { label: '节日', prefix: 'idle_holiday' },
  { label: '节日互动', prefix: 'interaction_holiday' },
  { label: '纪念日', prefix: 'personal_milestone' },
  { label: '饥饿', prefix: 'hunger' },
]

const PLOT_IDS = ['plot_tea_shop', 'plot_rain_window', 'plot_late_night']
const PLOT_LABELS: Record<string, string> = {
  plot_tea_shop: '茶铺',
  plot_rain_window: '雨窗',
  plot_late_night: '深夜',
}

const TIER_OPTIONS = [
  { value: '', label: '当前' },
  { value: 'low', label: 'low (初识)' },
  { value: 'mid', label: 'mid (熟悉)' },
  { value: 'high', label: 'high (亲密)' },
]

function DebugPanel() {
  const { appState } = usePetStore()
  const [filter, setFilter] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [debugTier, setDebugTier] = useState('')

  const allTypes = ALL_DIALOGUE_TYPES as readonly string[]

  async function triggerDialogue(type: string) {
    const tier = debugTier || undefined
    const result = await window.petApp.debugShowDialogue(type, tier) as { state: unknown; bubbleText: string | null }
    usePetStore.setState({ appState: result.state as NonNullable<typeof appState>, bubbleText: result.bubbleText })
  }

  async function triggerPlot(plotId: string) {
    const result = await window.petApp.debugShowBranchPlot(plotId) as {
      state: unknown; bubbleText: string | null; branchChoices?: { id: string; label: string }[]
    }
    usePetStore.setState({
      appState: result.state as NonNullable<typeof appState>,
      bubbleText: result.bubbleText,
      branchChoices: result.branchChoices ?? null,
    })
  }

  const filteredTypes = filter
    ? allTypes.filter((t) => t.includes(filter))
    : allTypes

  return (
    <div className="panel-body debug-panel">
      <div className="debug-section">
        <div className="debug-section-title">状态速览</div>
        <div className="debug-state-grid">
          <span>关系: {appState?.relationshipTier}</span>
          <span>好感: {appState?.stats.favorability}</span>
          <span>心情: {appState?.stats.mood}</span>
          <span>精力: {appState?.stats.energy}</span>
          <span>饱腹: {Math.round(appState?.stats.satiety ?? 0)}</span>
          <span>互动: {appState?.stats.interactionCount}</span>
          <span>状态: {appState?.mainState}</span>
          <span>表情: {appState?.currentExpression}</span>
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">亲密度覆盖</div>
        <div className="debug-btn-row">
          {TIER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`debug-btn ${debugTier === opt.value ? 'debug-btn-active' : ''}`}
              onClick={() => setDebugTier(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">分支剧情</div>
        <div className="debug-btn-row">
          {PLOT_IDS.map((id) => (
            <button key={id} className="debug-btn" onClick={() => triggerPlot(id)}>
              {PLOT_LABELS[id] ?? id}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">台词类型 ({filteredTypes.length})</div>
        <input
          className="debug-filter"
          type="text"
          placeholder="搜索类型名..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {!filter && (
          <div className="debug-groups">
            {DIALOGUE_TYPE_GROUPS.map((g) => {
              const types = allTypes.filter((t) => t.startsWith(g.prefix) || t.includes(g.prefix))
              const isOpen = expandedGroup === g.prefix
              return (
                <div key={g.prefix} className="debug-group">
                  <button
                    className="debug-group-header"
                    onClick={() => setExpandedGroup(isOpen ? null : g.prefix)}
                  >
                    {isOpen ? '▾' : '▸'} {g.label} ({types.length})
                  </button>
                  {isOpen && (
                    <div className="debug-group-items">
                      {types.map((t) => (
                        <button key={t} className="debug-type-btn" onClick={() => triggerDialogue(t)}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {filter && (
          <div className="debug-type-list">
            {filteredTypes.map((t) => (
              <button key={t} className="debug-type-btn" onClick={() => triggerDialogue(t)}>
                {t}
              </button>
            ))}
            {filteredTypes.length === 0 && <span className="debug-empty">无匹配</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// AIGC END
