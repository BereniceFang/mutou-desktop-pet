# Mutou Desktop Pet

**木头** -- 一个住在你桌面上的陪伴精灵。

猫耳少年形象，温柔但不卑微，会撒娇但不黏腻。他会观察你的日常、记录你们的故事、在你专注时安静守着、在你难过时轻声陪伴。

## Features

**日常互动**
- 单击触发对话，双击快捷安抚，右键打开菜单
- 拖拽时会轻声抗议
- 随机冒泡闲聊（频率可调：高/中/低）
- 时段问候（早/午/下午/晚/夜）
- 分支剧情（茶铺/雨窗/深夜 三个互动场景）

**关系系统**
- 三阶段关系：初识 → 熟悉 → 亲密
- 好感度通过互动/喂食/专注慢慢积累
- 升级时触发特殊仪式台词
- 连续签到追踪，连续来访有额外好感奖励
- 不同关系阶段有不同的台词风格

**喂食系统**
- 34 种食物，分甜食/水果/饮品/咸食/正餐五类
- 按关系等级逐步解锁
- 6 种节日限定食物（夏日冰激凌、饺子、汤圆、月饼、粽子、生日蛋糕）
- 饱腹度系统：不同类别饱腹值不同，自然衰减
- 连续喂食会触发特殊台词

**专注模式**
- 预设 15/25/45/60/90 分钟或自定义
- SVG 进度环实时倒计时
- 超时提醒
- 完成时三种回顾语气：搞定了 / 做了一部分 / 先到这里
- 历史统计：完成次数、总分钟数、中断次数

**日记本**
- 独立窗口，精致的日记阅读体验
- 木头每天自动写日记，记录互动/喂食/专注/心情
- 模板组合式生成，不重复不机械
- 缺席日会写想念的碎碎念
- 前后翻页快速切换
- 数据存储优化：只存汇总，实时渲染

**心情签到**
- 每天首次打开弹出心情选择
- 四种心情：很好 / 还行 / 有点累 / 不太好
- 木头即时回应 + 写入当日日记

**收藏系统**
- 11 枚徽章 + 21 张故事卡
- 基于互动/陪伴/专注/喂食/节日等条件解锁
- 新解锁时桌面弹出通知

**节日 & 纪念日**
- 木头生日（4.16）、元旦、五一、国庆、圣诞
- 支持自定义最多 8 个个人纪念日
- 节日当天触发专属台词和日记

**安慰系统**
- 自动检测：专注中断/深夜互动/低心情/低精力/连续点击
- 手动入口：轻声陪伴 / 认真安慰
- 双击精灵 = 快捷安抚

**状态衰减**
- 心情：每小时 -1.5（下限 30）
- 精力：每小时 -2.0（下限 20）
- 饱腹：每小时 -3.25（互动也消耗）
- 需要持续互动和喂食来维持状态

**个性化设置**
- 昵称（台词中自动替换）
- 气泡样式：背景/边框/文字颜色 + 透明度
- 窗口透明度、置顶开关
- 深夜安抚开关
- 随机冒泡频率
- 安全退出（告别语 + 数据保存）

## Tech Stack

- **Electron 41** -- 桌面应用框架，无边框透明窗口
- **React 19** -- 渲染层
- **TypeScript 6** -- 全栈类型安全
- **Vite 8** -- 前端构建 + HMR
- **Zustand** -- 状态管理
- **Zod** -- 运行时 schema 校验

## Project Structure

```
src/
  shared/          # Zod schemas, types, food catalog
  domain/          # State machine, collection unlock, holiday logic
  infrastructure/  # Content loaders, storage layer
  application/     # RuntimeService, DiaryService
  main/            # Electron main process
  preload/         # IPC bridge (window.petApp)
  renderer/        # React UI, Zustand stores, styles
content/
  dialogues/       # 1300+ dialogue lines (4 bundles)
  diary/           # Diary templates (30+ categories)
  collection/      # Badges & story cards
  holidays/        # Holiday calendar
  farewell/        # 52 farewell lines
  interactive-plots.json  # 3 branching scenarios
```

## Development

```bash
npm install
npm run dev          # Vite + Electron with HMR
npm run build        # TypeScript check + Vite build
npm run dist         # Build distributable (DMG/NSIS)
```

## Data Storage

User data stored in Electron's `userData` directory (not in project):
- `settings.json` -- User preferences
- `runtime-state.json` -- Pet state (mood, energy, favorability...)
- `diary-events.json` -- Raw interaction events
- `diary-day-summaries.json` -- Daily aggregated data

Window position and all settings persist across sessions.

## License

Private project.
