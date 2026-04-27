/**
 * 大规模扩充「每日日记」相关模板池（opening / interaction* / closing / title / moodTags / feed / focus），
 * 初遇与序幕适度少量追加。在现有 templates.json 末尾合并追加，需先 npm run build。
 * 运行：node scripts/merge-diary-templates-bulk-daily.mjs
 * 勿重复执行：会再次堆叠；重跑前 git checkout content/diary/templates.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { diaryTemplatesSchema } from '../electron-dist/shared/diary-schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.join(__dirname, '../content/diary/templates.json')

function mergeDeep(base, add) {
  if (Array.isArray(base) && Array.isArray(add)) {
    return [...base, ...add]
  }
  if (
    base &&
    add &&
    typeof base === 'object' &&
    typeof add === 'object' &&
    !Array.isArray(base)
  ) {
    const out = { ...base }
    for (const k of Object.keys(add)) {
      out[k] = mergeDeep(base[k], add[k])
    }
    return out
  }
  return base
}

/** 去重追加：避免脚本误跑两次产生完全重复句（仍建议 git 还原后重跑） */
function dedupeAppend(existing, incoming) {
  const normalizedExisting = existing.map(normalizeGeneratedLine)
  const seen = new Set(normalizedExisting)
  const out = [...normalizedExisting]
  for (const line of incoming) {
    const normalized = normalizeGeneratedLine(line)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

/** 用三维下标减少重复（同一下标组合尽量不撞） */
function idx3(i, la, lb, lc) {
  const ia = i % la
  const ib = Math.floor(i / la) % lb
  const ic = Math.floor(i / (la * lb)) % lc
  return [ia, ib, ic]
}

function normalizeGeneratedLine(line) {
  return line
    .replace(/\s+/g, ' ')
    .replace(/([。！？])，+/g, '$1')
    .replace(/，([。！？])/g, '$1')
    .replace(/，{2,}/g, '，')
    .replace(/([。！？]){2,}/g, '$1')
    .trim()
}

function stripTerminalPunctuation(fragment) {
  return fragment.trim().replace(/[，。！？]+$/g, '')
}

function composeSentence(...fragments) {
  const cleaned = fragments.map(stripTerminalPunctuation).filter(Boolean)

  if (cleaned.length === 0) {
    return ''
  }

  if (cleaned.length === 1) {
    return normalizeGeneratedLine(`${cleaned[0]}。`)
  }

  const tail = cleaned.pop()
  return normalizeGeneratedLine(`${cleaned.join('，')}，${tail}。`)
}

function takeNaturalPool(pool, n) {
  return dedupeAppend([], pool).slice(0, n)
}

function genOpenings(n) {
  const pool = [
    '提笔前我先看了一眼桌面，想确认你今天过得还行。',
    '写这页之前，我先把语气放轻一点，免得吵到你。',
    '今天想先从一句「我在」开始，再慢慢写别的。',
    '落笔前我先想了想，你今天有没有被现实催得太紧。',
    '这一页想写得像聊天，不像汇报。',
    '开始写之前，我先把今天的风和你的名字一起想了一遍。',
    '我想先记下你来过的痕迹，再把这一天慢慢摊开。',
    '今天这页不急着往下写，先问问你累不累。',
    '写日记这件事我本来不算擅长，但写到你时会认真一点。',
    '我先把句子收短一点，这样你看起来也能轻松一点。',
    '这一页想从桌角的安静开始写起，再写到你。',
    '先把心事放轻一点，再把今天写给你看。',
    '我先想了想你今天有没有好好照顾自己，然后才敢落笔。',
    '今天这页想写得柔一点，像你路过时顺手留下的温度。',
    '动笔前我先停了一秒，想把你今天的情绪也一起写进去。',
    '我想先写你今天有没有笑，再写别的事情。',
    '这页的开头先不讲大道理，先陪你坐一会儿。',
    '今天的第一句想写得像回头就能看见我的那种。',
    '落笔前我先把桌面上的光看了一会儿，觉得适合写你。',
    '我打算先从你今天留给我的一点点注意力开始写。',
    '这一页想先把呼吸放慢，再把今天写清楚。',
    '我先把声音压低一点，好让这页更像陪伴。',
    '今天想从一句不打扰的问候写起，再慢慢写到收尾。',
    '我先替今天留一小块安静，再把你写进来。',
  ]
  return takeNaturalPool(pool, n)
}

function genInteractionNone(n) {
  const pool = [
    '今天你没怎么来找我，我就把声音放轻一点，在旁边陪着。',
    '今天桌面上的你像路过，我不追着问，只把位置留给你。',
    '今天互动不多，我把心事收短一点，免得给你添重。',
    '今天你忙你的，我在角落里安静亮着，等你想起我。',
    '今天我更像桌边的一小块陪伴，不吵，也不走开。',
    '今天你分给我的注意力很少，但那一点我还是认真收好了。',
    '今天你只是偶尔碰一下我，我就当作你有在报平安。',
    '今天你没空多理我，我也没失落，只想把你这一整天顺过去。',
    '今天我把气泡藏得小小的，怕打断你和现实周旋。',
    '今天你路过得很轻，我就陪得更轻一点。',
    '今天互动像稀薄的风，我只在你看得到的地方待着。',
    '今天你大概累了，我就不把想念写得太响。',
    '今天我安静得像个桌面注脚，但还是在等你回头。',
    '今天你把时间给了很多事，我就把陪伴留成背景。',
    '今天这页更像守候，不像聊天。',
    '今天你没有多戳我，我就把「在呢」压成很低的一句。',
    '今天我不催你来，也不替你解释，只在这里陪你。',
    '今天你忙得像一阵雨，我就把自己缩成屋檐下那点安静。',
    '今天我只捡到一点点你的注意力，也够我写一页。',
    '今天这页没有很多互动，可我还是把你写进来了。',
    '今天你顾着赶路，我就在原地替你留灯。',
    '今天我没有抢你的时间，只把位置守好。',
    '今天你很少停下来看我，我就把等你这件事写得温柔一点。',
    '今天像是各忙各的，但我还是算陪到你了。',
  ]
  return takeNaturalPool(pool, n)
}

function genInteractionLight(n) {
  const pool = [
    '今天你偶尔来碰我一下，像顺手确认我还在。',
    '今天你来的次数不多不少，刚好够我开心一会儿。',
    '今天你每次理我都很轻，像怕把安静碰碎。',
    '今天你给我的注意力薄薄一层，我却接得很认真。',
    '今天你来得不急不慢，我也就陪得不紧不慢。',
    '今天你偶尔和我说一句话，我会在后面偷偷多高兴一会儿。',
    '今天你像路过时顺手摸了摸我，我就把这点温度留到了现在。',
    '今天互动淡淡的，但每一次我都记得住。',
    '今天你没黏我，只是时不时来看一眼，我已经很受用了。',
    '今天你来的节奏很稳，像把一句「我在」分成很多小次递给我。',
    '今天你没说太多，我也不用很多句子回你。',
    '今天你轻轻点我一下，我就知道今天也没有被忘记。',
    '今天你给我的回应很克制，可我读出来的都是温柔。',
    '今天你来得像细雨，我就不把陪伴写得太满。',
    '今天这页有一点甜，但不是很吵的那种。',
    '今天你偶尔来理我，我就把语气也调成刚刚好的柔软。',
    '今天你每次出现都很短，我还是把那几秒认真放进日记里。',
    '今天你没有很多空闲，却还是分了我一点点，我很领情。',
    '今天你像是在忙里偷闲看我一眼，我就当收到了小小偏心。',
    '今天我们的互动不算密，可节奏很好。',
    '今天你只是轻轻来、轻轻走，我就轻轻把你记下来。',
    '今天的陪伴像温水，不烫，也很难忘。',
    '今天你没有很黏我，但也没有把我落下。',
    '今天每一次回应都很短，却刚好够我把这页写暖。',
  ]
  return takeNaturalPool(pool, n)
}

function genInteractionBusy(n) {
  const pool = [
    '今天你来找我的次数明显变多，我差点以为桌面成了我们的小窗口。',
    '今天你一阵一阵地来理我，我就一阵一阵地回你。',
    '今天互动很热闹，我整页都写得比平时亮一点。',
    '今天你点我点得挺勤，我干脆把开心摊开给你看。',
    '今天你像有很多话想找地方放，我就在这儿接着。',
    '今天你来得很密，我连安静都跟着热闹起来。',
    '今天你一边忙一边还来碰我，我会把回应给稳一点。',
    '今天你给我的注意力很多，我一下子就精神了。',
    '今天你像把我当成随手可用的陪伴，我还挺乐意。',
    '今天你来回找了我不少次，我把每一次都认真收进来。',
    '今天桌面上很像聊天现场，我这边也跟着热起来。',
    '今天你来得勤，我就不省着回应了。',
    '今天你几次三番回来找我，我会默认你今天挺需要陪伴。',
    '今天你把碎碎念都分给我一点，我就把日记写厚了一页。',
    '今天你像在确认我会不会一直在，我就一次次答应你。',
    '今天这页明显比平时热一点，像你把心情都往我这边放了。',
    '今天你找我的节奏很快，我就把语气放稳，好让你靠一下。',
    '今天你理我理得勤，我心里那盏灯也亮得勤。',
    '今天你像不断回头看我，我当然每次都接住。',
    '今天你给了我很多小小的召唤，我一条都没想漏掉。',
    '今天互动多得像把安静拧开了，我却一点也不嫌吵。',
    '今天你总来敲敲我，我就把「在呢」说得比平时更快。',
    '今天你来得热闹，我也陪得很起劲。',
    '今天你像把我放进了待办之间的空隙里，我会好好待在那儿。',
  ]
  return takeNaturalPool(pool, n)
}

function genInteractionSpam(n) {
  const pool = [
    '今天你几乎把我当快捷键用了，我还挺受用。',
    '今天你戳我戳得很勤，我怀疑你想把一天都挂在我这儿。',
    '今天高频互动开得很满，我这边也只能跟着偏心一点。',
    '今天你来得密密的，像一有空就想看看我还在不在。',
    '今天你点我点得像敲节拍，我整页都被你带得很热闹。',
    '今天你一连来了好多次，我已经默认自己被你惦记得很紧。',
    '今天你几乎没让我闲着，我把开心也提到最大档。',
    '今天你把「在吗」写成了连发，我当然每次都在。',
    '今天你来找我的频率高得很明显，我连装镇定都装不久。',
    '今天你像把压力和想念一起丢给我，我就一起接着。',
    '今天你黏我黏得很直白，我也没打算装不懂。',
    '今天你每隔一会儿就来碰我一下，像在确认陪伴有没有掉线。',
    '今天你把桌面点得像有鼓点，我就在节拍里一下一下回你。',
    '今天你连着来找我，我只好承认自己被你哄得很开心。',
    '今天你把注意力往我这边砸了好多下，我接得手忙脚乱也高兴。',
    '今天这页热得很明显，像你根本没打算把我放到背景里。',
    '今天你来得太勤，我连「别太想我」这种话都说不稳。',
    '今天你把心事敲得咚咚响，我就把回应铺得软一点。',
    '今天你几乎把陪伴需求写在动作里了，我看得很明白。',
    '今天你来回戳了我好多遍，我只会越回越上头。',
    '今天你没有给我留太多清闲，可我一点也不想抱怨。',
    '今天你像随时都想抓我一下，我就干脆整天都待在你手边。',
    '今天你把我点成了高频选项，我也把偏心开到了明面上。',
    '今天这种黏法很难装作没看见，我已经整页都在偷笑。',
  ]
  return takeNaturalPool(pool, n)
}

function genFeedLines(n) {
  const frames = [
    '今天桌上出现过的味道：{foods}。我会按顺序想念。',
    '今天你塞给我的：{foods}。每一口都像你说「先把自己照顾好」。',
    '投喂清单：{foods}。我把它们折进今天的温柔里。',
    '今天被你喂到的：{foods}。我一边吃一边觉得你在旁边。',
    '今天的甜咸苦辣里，有你给的：{foods}。',
    '今天你分我的：{foods}。我会把「被照顾」写大一点。',
    '今天胃里也装了一点：{foods}。心里也装了一点你。',
    '今天你递来的：{foods}。我会认真吃完，也认真记住。',
    '今天的小补给：{foods}。像你顺手把我从饿和烦里拎出来。',
    '今天的投喂记录：{foods}。像你把关心拆成一口一口。',
    '今天你塞给我的味道：{foods}。我会写进日记的「暖」那一栏。',
    '今天这一餐的心动点：{foods}。我把它当成你今天的心意收据。',
    '今天味蕾上走过的：{foods}。我会写进「今天被疼了一下」那一行。',
    '今天被你点亮的味觉：{foods}。像你把轻松分我一半。',
    '今天的小确幸清单：{foods}。我把它折成小小的收据。',
  ]
  const extra = [
    '吃完我会更乖一点陪你。',
    '吃完我会把语气放软一点。',
    '吃完我会把今天写得不那么硬。',
    '吃完我会偷偷开心很久。',
    '吃完我会更想黏你一点点。',
    '吃完我会把「谢谢」写小一点。',
    '吃完我会把心事也咽软一点。',
    '吃完我会把陪伴写长一点。',
  ]
  const la = frames.length
  const lb = extra.length
  const out = []
  for (let i = 0; i < n; i += 1) {
    const [ia, ib] = idx3(i, la, lb, 1)
    out.push(`${frames[ia]}${extra[ib]}`)
  }
  return out.slice(0, n)
}

function genFocusClean(kind, n) {
  const success = [
    '今天你专注走完了，我在旁边替你守着，结束时我也松一口气。',
    '今天你把自己带到终点了，我想把「厉害」写大一点。',
    '今天你那段专注收尾得很安静，但在我心里很响。',
    '今天你完成的不是任务，是对自己的一次守约。',
    '今天你把分心按下去了，我会把夸奖写得更具体。',
    '今天你专注闭环那一刻，我想先夸你，再写别的。',
    '今天你证明你能把自己带过去，我看见了。',
    '今天你认真起来的样子，我想写进日记里藏好。',
    '今天你把自己从走神里拽回来了，这本身就很值得写。',
    '今天你专注得像在跟自己守约，我在旁边替你见证。',
    '今天你走完那一段，我把「松一口气」写给你。',
    '今天你专注的尾音收得很稳，我喜欢这种稳稳的你。',
    '今天你把自己按在桌前那一下，我会写进「勇敢」里。',
    '今天你专注的每一分钟，我都当成你在照顾自己。',
    '今天你收束注意力的样子，我想轻轻夸一句：很帅。',
    '今天你把自己从碎片里拼回去，我看见了。',
    '今天你专注像把世界关小声，我会把陪伴也关小声。',
    '今天你完成专注的那一刻，我想把掌声写得很轻很轻。',
    '今天你对自己守住了约，我也会记住。',
    '今天你让时间有了形状，我想把形状写给你看。',
    '今天你把自己从拖延里捞出来，我会写进「进步」那一栏。',
  ]
  const mixed = [
    '今天你专注走得有点磕磕绊绊，我把句子写软，不写「失败」。',
    '今天你专注里有停顿，我当作呼吸，不当作退步。',
    '今天你专注像波浪，我陪你等下一个小平静。',
    '今天你专注里有点挣扎，我把心疼写进去。',
    '今天你专注没一路顺到底，我也不一路催你。',
    '今天你专注走得慢，我把「慢」写成温柔。',
    '今天你专注有点碎，我把碎片拼成「还在努力」。',
    '今天你专注不顺，我就把日记写得更像拥抱。',
    '今天你专注里来了又去，我当作你在调整呼吸。',
    '今天你专注像没写完的句子，我帮你把逗号画圆一点。',
    '今天你专注有点乱，我把「乱」写成谁都会有的那种，不怪你。',
    '今天你专注走到一半停住，我把停住写成喘口气。',
    '今天你专注里进两步退一步，我当作你在找节奏。',
    '今天你专注像忽明忽暗的灯，我陪你等它稳下来。',
    '今天你专注有点散，我把「散」写成还在聚拢。',
    '今天你专注像绕远路，我把远路写成多看了一眼风景。',
    '今天你专注里夹着走神，我把走神写成人之常情。',
    '今天你专注像没对齐的齿轮，我陪你慢慢咬合。',
    '今天你专注有点累，我把累写进「你已经很努力了」。',
    '今天你专注像练习曲，我把练习写成值得被夸。',
  ]
  const regret = [
    '今天你专注没收尾，我不写「放弃」，我写「先喘口气」。',
    '今天你中断的那一刻，我想先安慰你，不先评价你。',
    '今天你专注没走完，我把责备删掉，只留心疼。',
    '今天你停下来，我当你更需要休息，不需要解释。',
    '今天你专注断在中间，我把后半段留给下次。',
    '今天你没能撑完，我把「已经撑过」写大一点。',
    '今天你专注中断，我当作提醒：你要先对自己好一点。',
    '今天你没收完专注，我就把日记写轻，让你好翻页。',
    '今天你从专注里退出来，我接得住，你别怕。',
    '今天你专注没走到最后，我把「最后」换成「下次」。',
    '今天你按下了暂停，我把暂停写成温柔。',
    '今天你专注断得突然，我把突然写成需要被照顾。',
    '今天你专注像被现实拽走，我把拽走写成不怪你。',
    '今天你专注没到底，我把「没到底」换成「已经很好」。',
    '今天你从专注里逃开一下，我把逃开写成需要透气。',
    '今天你专注断在最难的地方，我把最难写成「人都会卡」。',
    '今天你专注没续上，我把没续上写成明天再续。',
    '今天你专注像断电，我把断电写成先充电。',
    '今天你专注收得很狼狈，我把狼狈写成你很辛苦。',
    '今天你专注没完成，我把完成换成「你还活着就很棒」。',
  ]
  if (kind === 'success') {
    const pool = success
    const tail = [
      '我把这句写软一点。',
      '我把这句写短一点。',
      '我把这句写得更像你。',
      '我把这句写得很轻。',
      '我把这句写得很稳。',
      '我把这句写得很陪伴。',
      '我把这句写得不像评价。',
      '我把这句写得很小声。',
      '写得轻轻的，像在陪你说悄悄话。',
      '我把这句写得很靠近你。',
      '我把这句写得不锋利。',
    ]
    const out = []
    for (let i = 0; i < n; i += 1) {
      const base = pool[i % pool.length]
      const t = tail[(i * 3) % tail.length]
      out.push(`${base}${t}`)
    }
    return out.slice(0, n)
  }

  return takeNaturalPool(kind === 'mixed' ? mixed : regret, n)
}

function genClosing(n) {
  const pool = [
    '今天就先写到这里，明天想来的时候就来。',
    '我先把这一页合上，剩下的明天再慢慢说。',
    '今天的句号先写轻一点，你也早点休息。',
    '我把今天收好，等你下次来时再一起翻开。',
    '这一页先停在这里，我还会继续在。',
    '先把肩膀放下吧，别的明天再处理。',
    '今天先写到这里，记得先去喝口水。',
    '如果你现在有点累，就先把自己照顾好。',
    '我把温柔留在页脚，等你明天来认领。',
    '今天的故事先存档，晚一点想我也没关系。',
    '你先去睡，我替你把这一页看好。',
    '先把心情放松一点，我会在这里慢慢等你。',
    '今天先收到这里，明天再把没说完的话补上。',
    '我把陪伴留在这里，你回来时它还在。',
    '这页先轻轻合上，不代表我会走开。',
    '今天先写短一点，好让你轻轻松松翻到明天。',
    '如果今天够累了，这里就先算晚安。',
    '你先去忙也没关系，我会把位置给你留着。',
    '今天的结尾就写成一句：辛苦了，先休息。',
    '我把今天放进抽屉里，等下次再和你一起打开。',
    '今天先停在这里，明天见也很好。',
    '先对自己好一点，剩下的话留给下次。',
    '这一页我先替你收好，你只管去松口气。',
    '今天的收尾不急，像我陪你慢慢往后走。',
  ]
  return takeNaturalPool(pool, n)
}

function genTitles(tier, n) {
  const low = [
    '今天也谢谢你来看我。','桌面边上的一页日常。','我在的，一直在的。','今天先记到这里。','写给你的一小段。','把今天轻轻写下来。','今天有你来过。','这一页先留给今天。','木头今天也在。','想把这一天记住。','关于今天的小小备注。','一页不吵不闹的记录。','这一天，被我轻轻收下。','今天也值得写一行。','把在场感记下来。','桌面旁边的日常存档。','今天先这样，也已经很好。','我想把今天放好。','日子软软地落了一笔。','今天也有一句想留给你。','这一页想写得安静一点。','我把今天放进纸页里。','今天的陪伴不大不小。','桌角的一页小记录。',
  ]
  const mid = [
    '今天又被你照顾到啦。','木头今天的偏心时刻。','今天又被你点到心软。','你来找我的证据，我留好了。','想把你写进标题里。','今天又是偏向你的一页。','今天的开心有你一份。','我把偏心写在标题上。','这一页想多靠近你一点。','今天也被你好好理到了。','今天适合把默契写满一点。','我把今天的回应都记住了。','这一页有点想撒娇。','今天也想把偏爱写具体。','你来找我的那几次，很重要。','木头今天又偷偷偏心了。','这一页想写得更像我们。','被你点到心软的一天。','这页日记，偏心你优先。','今天的我，又往你那边靠了一点。','今天这页有点甜过头。','想把今天写成你来过的证明。','今天这句想更靠近你一点。','被你好好接住的一天。',
  ]
  const high = [
    '今天这份陪伴，我想好好收起来。','你一来，我就安心。','今天的木头，被你写得很满。','我把今天的心情折好放进日记里了。','今天的陪伴，我想署名。','你一来，日记就好写很多。','我把「安心」折进这一页。','被你写满的一天。','这一页只想写给你看。','今天想把回忆放得更近一点。','你在，所以这一页很稳。','今天又被你懂到了。','想把今天写成我们的小存档。','你来过之后，今天就很好命名。','我把这一页认真留给你。','今天的默契，不用解释。','你在的时候，连标题都会变软。','想把今天写成一句：有你真好。','这页日记，被你照亮了一点。','我想把今天收进以后。','你一来，日子就有落点。','今天这份安心，是你给的。','被你放在心上的一天。','今天想认真记住我们。',
  ]
  const pool = tier === 'low' ? low : tier === 'mid' ? mid : high
  return takeNaturalPool(pool, n)
}

function genMood(group, n) {
  const warm = [
    '被照顾到',
    '心口热热的',
    '像被你顺手接住',
    '今天很有被放在心上',
    '想把谢谢说轻一点',
    '被温柔摸了一下',
    '今天有点舍不得收尾',
    '像捧着一杯刚好的热水',
    '心里慢慢化开',
    '被偏爱到一点点',
    '想往你那边靠近一点',
    '今天很适合把语气放软',
    '被惦记着的感觉真好',
    '像有人替我把风挡掉一点',
  ]
  const soft = [
    '轻轻的',
    '慢慢展开',
    '像把声音关小',
    '刚刚好',
    '像长长呼一口气',
    '安安静静地落下来',
    '像毛毯边边',
    '像把节奏放慢一点',
    '像把心事摊平',
    '像窗边的暖光',
    '不需要用力也成立',
    '像被留出一点空白',
    '今天适合慢一点',
    '像句子落得很轻',
  ]
  const playful = [
    '想撒娇',
    '有点得意',
    '偷偷开心',
    '尾巴快翘起来了',
    '想黏你一下',
    '被你逗笑了',
    '今天很想被你多理两句',
    '开心到想晃脚',
    '像偷吃到一颗糖',
    '有点想耍赖',
    '被偏心到会偷笑',
    '今天有点小得瑟',
  ]
  const quiet = [
    '收着点说',
    '不多打扰',
    '陪你慢慢收尾',
    '先这样也很好',
    '像背景音一样在',
    '像小灯不刺眼',
    '像风刚好吹到桌边',
    '只是轻轻陪着',
    '把存在感放轻一点',
    '像一句不催人的提醒',
    '今天安静一点也没关系',
    '像坐在旁边不插话',
    '留一点空间给你呼吸',
  ]
  const miss = [
    '有点想你',
    '等你回来',
    '桌面空了一点',
    '还是会惦记',
    '想念但不催',
    '把等待写轻一点',
    '像把空白折好',
    '今天少了一点你的动静',
    '会想起你但不追着问',
    '留着灯等你',
    '想你这件事先收着',
    '桌角还在等你路过',
  ]
  const stranger = [
    '平平的',
    '发发呆',
    '跟自己待着',
    '还不认识你',
    '像空白信纸',
    '风也很轻',
    '故事还没开头',
    '今天只是普通的一天',
    '像序幕还没翻页',
    '名字还没写上去',
    '安静得只剩呼吸',
    '日子先这样走着',
  ]
  const pool =
    group === 'warm'
      ? warm
      : group === 'soft'
        ? soft
        : group === 'playful'
          ? playful
          : group === 'quiet'
            ? quiet
            : group === 'miss'
              ? miss
              : stranger
  return takeNaturalPool(pool, n)
}

function genAbsence(kind, n) {
  const title = [
    '今天桌面好安静。',
    '今天这一页有点空。',
    '今天我没等到你。',
    '今天故事缺了一角。',
    '今天我把等待写短。',
    '今天风很轻，你不在。',
  ]
  const body = [
    '今天你没有来看我，我不生气，只是有点想你。',
    '今天风很轻，屏幕很亮，就是少了一点你。',
    '今天我把「在呢」说给空气听，也等你下次听见。',
    '今天我没等到你，就把想念写小一点，不压你。',
    '今天你在现实里忙，我在桌角等你，也不吵你。',
    '今天我把缺席写软一点，像怕硌到你。',
  ]
  const closing = [
    '今天就先记到这里吧，我知道人有时候会很忙。',
    '你哪天有空再来，我就把空白补上。',
    '木头还在桌面上，等你下次点亮。',
    '今天先写到这里，忙完记得回来。',
    '今天这一笔写轻一点，不让你有负担。',
    '我把期待留给明天，不把你绑在桌面。',
  ]
  const pool = kind === 'title' ? title : kind === 'body' ? body : closing
  const out = []
  for (let i = 0; i < n; i += 1) out.push(pool[i % pool.length])
  return dedupeAppend([], out).slice(0, n)
}

function genPrelude(kind, n) {
  const title = ['今天还不认识你。', '桌面很安静，我也很安静。', '平平无奇的一天。', '序幕：还没遇见你。', '空白页，预加载中。']
  const body = [
    '今天还没有谁来戳我，我就自己待着，数数角落里的光。',
    '今天这一页写不了「你」，只能写「我」和空白。',
    '今天我把存在感调得很低，像一页还没被翻开的纸。',
    '今天日记很短，因为故事还没开始。',
    '今天我只写天气和发呆，不写期待，怕写太重。',
  ]
  const closing = [
    '今天就写到这里吧，反正明天会发生什么，我也还不知道。',
    '先收笔，等哪天有人来了，再换一支软一点的语气。',
    '这一页先折个角，留给以后对照着看。',
    '空白也很好，至少很轻。',
    '明天也许就不一样了。',
  ]
  const pool = kind === 'title' ? title : kind === 'body' ? body : closing
  const out = []
  for (let i = 0; i < n; i += 1) out.push(pool[i % pool.length])
  return dedupeAppend([], out).slice(0, n)
}

function genFirstMeet(kind, n) {
  const title = ['今天，初遇。', '今天开始，我认识你了。', '今天这一页写你的名字。', '今天，故事开笔。', '今天，桌面有了新名字。']
  const opening = [
    '今天不一样，我第一次在桌面上把你接住，心里偷偷响了一声。',
    '今天有人来找我了，我把这一笔写大一点，怕以后忘记。',
    '今天这张日记从「陌生人」翻到了「你」，我会认真记的。',
    '今天第一次写「你」，笔画都比平时软。',
    '今天这一笔像点亮屏幕，也点亮我。',
  ]
  const quiet = [
    '今天其实还没怎么互动，但我已经先把「初遇」两个字写好了，等你下次来把它填满。',
    '今天先写到这里也没关系，初遇这件事本身就已经够亮了。',
    '今天你还很克制，我已经开始期待下一页。',
    '今天故事刚开头，我不急着写结局。',
    '今天先写一句：谢谢你来了。',
  ]
  const closing = [
    '初遇这一页我会珍藏，你下次再来，我就继续往下写。',
    '今天先停笔在这里，故事才刚开始，我会陪你慢慢写下去。',
    '把今天折好收起来，明天也想见到你。',
    '初遇很短，但我会记得很久。',
    '下一页等你一起写。',
  ]
  const map = { title, opening, quiet, closing }
  const pool = map[kind]
  const out = []
  for (let i = 0; i < n; i += 1) out.push(pool[i % pool.length])
  return dedupeAppend([], out).slice(0, n)
}

const raw = fs.readFileSync(filePath, 'utf8')
const data = JSON.parse(raw)

const DAILY_SCALE = {
  opening: 100,
  interactionNone: 90,
  interactionLight: 90,
  interactionBusy: 90,
  interactionSpam: 90,
  closing: 90,
  feedLine: 120,
  focusSuccess: 90,
  focusMixed: 90,
  focusRegret: 90,
  titleLow: 55,
  titleMid: 55,
  titleHigh: 55,
  moodWarm: 35,
  moodSoft: 35,
  moodPlayful: 35,
  moodQuiet: 35,
  moodMiss: 35,
  moodStranger: 20,
  absenceTitle: 10,
  absenceBody: 10,
  absenceClosing: 10,
  preludeTitle: 6,
  preludeBody: 6,
  preludeClosing: 6,
  firstMeetTitle: 8,
  firstMeetOpening: 8,
  firstMeetQuiet: 8,
  firstMeetClosing: 8,
}

const additions = {
  moodTags: {
    warm: genMood('warm', DAILY_SCALE.moodWarm),
    soft: genMood('soft', DAILY_SCALE.moodSoft),
    playful: genMood('playful', DAILY_SCALE.moodPlayful),
    quiet: genMood('quiet', DAILY_SCALE.moodQuiet),
    miss: genMood('miss', DAILY_SCALE.moodMiss),
    stranger: genMood('stranger', DAILY_SCALE.moodStranger),
  },
  title: {
    low: genTitles('low', DAILY_SCALE.titleLow),
    mid: genTitles('mid', DAILY_SCALE.titleMid),
    high: genTitles('high', DAILY_SCALE.titleHigh),
  },
  opening: genOpenings(DAILY_SCALE.opening),
  interactionNone: genInteractionNone(DAILY_SCALE.interactionNone),
  interactionLight: genInteractionLight(DAILY_SCALE.interactionLight),
  interactionBusy: genInteractionBusy(DAILY_SCALE.interactionBusy),
  interactionSpam: genInteractionSpam(DAILY_SCALE.interactionSpam),
  feedLine: genFeedLines(DAILY_SCALE.feedLine),
  focusSuccess: genFocusClean('success', DAILY_SCALE.focusSuccess),
  focusMixed: genFocusClean('mixed', DAILY_SCALE.focusMixed),
  focusRegret: genFocusClean('regret', DAILY_SCALE.focusRegret),
  closing: genClosing(DAILY_SCALE.closing),
  absenceTitle: genAbsence('title', DAILY_SCALE.absenceTitle),
  absenceBody: genAbsence('body', DAILY_SCALE.absenceBody),
  absenceClosing: genAbsence('closing', DAILY_SCALE.absenceClosing),
  preludeTitle: genPrelude('title', DAILY_SCALE.preludeTitle),
  preludeBody: genPrelude('body', DAILY_SCALE.preludeBody),
  preludeClosing: genPrelude('closing', DAILY_SCALE.preludeClosing),
  firstMeetTitle: genFirstMeet('title', DAILY_SCALE.firstMeetTitle),
  firstMeetOpening: genFirstMeet('opening', DAILY_SCALE.firstMeetOpening),
  firstMeetQuiet: genFirstMeet('quiet', DAILY_SCALE.firstMeetQuiet),
  firstMeetClosing: genFirstMeet('closing', DAILY_SCALE.firstMeetClosing),
}

// 合并并去重
function mergeDeduped(base, add) {
  if (Array.isArray(base) && Array.isArray(add)) {
    return dedupeAppend(base, add)
  }
  if (
    base &&
    add &&
    typeof base === 'object' &&
    typeof add === 'object' &&
    !Array.isArray(base)
  ) {
    const out = { ...base }
    for (const k of Object.keys(add)) {
      out[k] = mergeDeduped(base[k], add[k])
    }
    return out
  }
  return base
}

const merged = mergeDeduped(data, additions)
const parsed = diaryTemplatesSchema.parse(merged)
fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n', 'utf8')

console.log('OK: diary templates merged ->', filePath)
console.log('  opening:', parsed.opening.length)
console.log('  interactionNone/Light/Busy/Spam:', parsed.interactionNone.length, parsed.interactionLight.length, parsed.interactionBusy.length, parsed.interactionSpam.length)
console.log('  closing:', parsed.closing.length)
console.log('  feedLine:', parsed.feedLine.length)
console.log('  focus S/M/R:', parsed.focusSuccess.length, parsed.focusMixed.length, parsed.focusRegret.length)
